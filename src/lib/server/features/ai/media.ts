// Transcripción (E08) e imagen (E09) del servicio de `ai` (BE-FR-35, BE-FR-36, BE-FR-38 CA2, BE-FR-44, D-08; FR-055,
// FR-056, FR-060; T184). Reutiliza el flujo común de `service.ts` (admisión, reserva, proveedor con reintentos, cobro y
// cierre). Lo propio de audio: el temporal en disco (borrado en `finally`), la duración medida con ffprobe, la conversión
// a mp3 para el respaldo y las reglas de `domain/transcription.ts`.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Converter } from '$lib/server/adapters/ffmpeg/converter';
import type { Prober } from '$lib/server/adapters/ffprobe/prober';
import type { Transcriber } from '$lib/server/adapters/mistral/transcriber';
import { immediateTransaction } from '$lib/server/db/tx';
import {
	chatOperationOf,
	getEffectiveConfig,
	type EffectiveOperation
} from '$lib/server/features/apps';
import { alertKeys, raiseAlert } from '$lib/server/features/notifications';
import { checkMaxCost, chargeFor } from '$lib/server/features/pricing';
import { AppError } from '$lib/server/shared/errors';
import { toMicro } from '$lib/shared/money';
import { toEpochMs, type EpochMs } from '$lib/shared/time';
import type { ImageResponseBody, TranscriptionResponseBody } from './contract';
import { checkMessageSizes, type ChatOperationView } from './domain/chat-input';
import {
	audioLimitOf,
	planTranscription,
	secondsToBill,
	transcriptionFailure,
	voxtralCostMicroUsd,
	type ProviderOutcome
} from './domain/transcription';
import { checkVariables, renderTemplate, type ChatMessage } from './domain/template-variables';
import {
	abandonUnexpected,
	admissionOf,
	billAndClose,
	callProvider,
	numberSetting,
	reject,
	rowOf,
	settleAbandoned,
	settleFailed,
	settleFlagged,
	toDefs,
	waitAbortable,
	type AiDeps,
	type ChatContext,
	protectionsOf
} from './service';
import { insertOperation, updateOperation } from './repository';
import { guardRequest } from '$lib/server/features/protections';

/** Adaptadores de audio y de Voxtral. `transcriber` es `null` si no hay clave: el principal figura como no configurado. */
export interface MediaDeps {
	readonly transcriber: Transcriber | null;
	readonly prober: Prober;
	readonly converter: Converter;
	/** Directorio donde se crea un temporal por petición de audio, que se borra en `finally`. */
	readonly tempRoot: string;
}

export interface AudioUpload {
	readonly bytes: Uint8Array;
	readonly name: string;
	readonly mimeType: string;
}

/** Tiempo máximo para medir la duración con ffprobe. */
const PROBE_TIMEOUT_MS = 10_000;
/** Indicación del respaldo: transcribir literalmente, sin resumir ni comentar (BE-FR-35). */
const BACKUP_PROMPT =
	'Transcribe literalmente este audio en su idioma original. Responde solo con la transcripción.';

interface Served {
	readonly provider: 'primary' | 'backup';
	readonly text: string;
	readonly providerSeconds: number | null;
	readonly model: string;
	readonly generationId: string | null;
	readonly costMicroUsd: number | null;
	readonly inputTokens: number | null;
	readonly outputTokens: number | null;
	readonly truncated: boolean;
}

/**
 * E08 · transcripción. Mide el audio, decide el coste máximo, reserva, intenta el principal (Voxtral, con reintentos a
 * 2, 4 y 8 s) y después el respaldo (OpenRouter con el audio en mp3), y cobra solo lo que factura cada proveedor. Devuelve
 * `null` si el cliente se fue antes de recibirla.
 */
export async function runTranscription(
	deps: AiDeps,
	media: MediaDeps,
	ctx: ChatContext,
	input: { readonly operation: string; readonly audio: AudioUpload }
): Promise<TranscriptionResponseBody | null> {
	// Pasos 6 a 8 de §8, y la ranura de concurrencia hasta que termina la transcripción (BE-FR-43).
	const release = guardRequest(protectionsOf(deps), {
		endpoint: 'ai',
		appId: ctx.appId,
		appVersion: ctx.appVersion,
		userId: ctx.userId,
		transcription: true
	});
	try {
		return await transcriptionFlow(deps, media, ctx, input);
	} finally {
		release();
	}
}

async function transcriptionFlow(
	deps: AiDeps,
	media: MediaDeps,
	ctx: ChatContext,
	input: { readonly operation: string; readonly audio: AudioUpload }
): Promise<TranscriptionResponseBody | null> {
	const now = toEpochMs(deps.clock.now());
	const { replay } = admissionOf(deps, ctx, input.operation, now);

	const op = chatOperationOf(deps.apps, ctx.appId, input.operation);
	if (op === undefined || !op.active || op.kind !== 'transcription' || op.transcription === null) {
		reject(deps, input.operation, 'unknown_operation', 'VALIDATION_ERROR', { field: 'operation' });
	}
	const config = op.transcription;
	const settings = getEffectiveConfig(deps.apps, {
		appId: ctx.appId,
		operationKey: input.operation
	}).settings;
	const primaryAvailable = config.primary.enabled && media.transcriber !== null;
	const backupAvailable = config.backup !== null;
	if (!planTranscription({ primaryEnabled: primaryAvailable, backupEnabled: backupAvailable }).ok) {
		throw new AppError('TRANSCRIPTION_FAILED', { primaryError: null, backupError: null });
	}

	const operationId = deps.ids('op');
	let holdId: string | null = null;
	const dir = await mkdtemp(join(media.tempRoot, 'ai-'));
	const original = join(dir, 'original');
	const pricePerMinute = numberSetting(deps, 'voxtral_price_per_minute_usd');
	try {
		await writeFile(original, input.audio.bytes, { mode: 0o600 });

		// Duración medida en el servidor (nunca la del cliente): ilegible o excesiva, se rechaza antes de cobrar nada.
		const probe = await media.prober.probe(original, {
			timeoutMs: PROBE_TIMEOUT_MS,
			signal: ctx.signal
		});
		if (probe.status === 'aborted') return null;
		if (probe.status !== 'ok') {
			reject(deps, input.operation, 'audio_unreadable', 'VALIDATION_ERROR', { field: 'file' });
		}
		const seconds = probe.durationSeconds;
		const limit = audioLimitOf({
			durationSeconds: seconds,
			maxSeconds: settings.max_audio_seconds,
			toleranceSeconds: settings.audio_duration_tolerance_seconds
		});
		if (!limit.ok) {
			reject(deps, input.operation, 'audio_too_long', 'AUDIO_TOO_LONG', {
				maxSeconds: limit.maxSeconds
			});
		}

		// Coste máximo: el precio más caro entre Voxtral y el respaldo. Sin precio del respaldo, el tope de la operación.
		const voxtralCharge = chargeFor(deps.pricing, {
			appId: ctx.appId,
			operationKey: input.operation,
			costMicroUsd: voxtralCostMicroUsd({ seconds, pricePerMinuteMicroUsd: pricePerMinute }),
			provider: 'mistral'
		}).chargeMicro;
		const backupCharge = !backupAvailable
			? 0
			: op.estimatedMaxCostMicroUsd === null
				? op.maxCostMicro
				: chargeFor(deps.pricing, {
						appId: ctx.appId,
						operationKey: input.operation,
						costMicroUsd: op.estimatedMaxCostMicroUsd,
						provider: 'openrouter'
					}).chargeMicro;
		const estimateMicro = Math.max(primaryAvailable ? voxtralCharge : 0, backupCharge);
		if (!checkMaxCost({ estimatedMicro: estimateMicro, maxMicro: op.maxCostMicro }).ok) {
			immediateTransaction(deps.db, (tx) => {
				insertOperation(
					tx,
					rowOf(
						ctx,
						op,
						operationId,
						ctx.idempotencyKey,
						now,
						'rejected',
						'OPERATION_TOO_EXPENSIVE'
					)
				);
			});
			reject(deps, input.operation, 'operation_too_expensive', 'OPERATION_TOO_EXPENSIVE');
		}

		// Transacción 1: fila en curso y reserva del coste máximo (BE-FR-71). Una repetición tras `undelivered` no reserva.
		const holdAmount = Math.max(1, estimateMicro);
		const reserved = immediateTransaction(deps.db, (tx) => {
			insertOperation(
				tx,
				rowOf(ctx, op, operationId, ctx.idempotencyKey, now, 'in_progress', null)
			);
			if (replay) return { ok: true as const, holdId: null };
			const outcome = deps.credits.reserve({
				userId: ctx.userId,
				appId: ctx.appId,
				operationId,
				amountMicro: holdAmount
			});
			if (!outcome.ok) {
				updateOperation(tx, operationId, {
					status: 'rejected',
					errorCode: 'INSUFFICIENT_BALANCE',
					completedAt: now
				});
				return { ok: false as const, outcome };
			}
			updateOperation(tx, operationId, { holdMicro: toMicro(holdAmount) });
			return { ok: true as const, holdId: outcome.holdId };
		});
		if (!reserved.ok) {
			const failure = reserved.outcome;
			throw new AppError(
				failure.reason === 'daily_free_limit' ? 'DAILY_FREE_LIMIT_REACHED' : 'INSUFFICIENT_BALANCE',
				failure.reason === 'insufficient_balance'
					? { requiredMicro: failure.requiredMicro, availableMicro: failure.availableMicro }
					: {}
			);
		}
		holdId = reserved.holdId;
		deps.logger.emit('ai.operation.started', { operationId, operation: input.operation });

		// Proveedores, fuera de transacción: primero Voxtral con reintentos, después el respaldo.
		let primaryOutcome: ProviderOutcome = primaryAvailable ? 'unavailable' : 'not_configured';
		let backupOutcome: ProviderOutcome = backupAvailable ? 'unavailable' : 'not_configured';
		let served: Served | null = null;
		let cancelled = ctx.signal.aborted;

		const transcriber = media.transcriber;
		if (primaryAvailable && transcriber !== null && !cancelled) {
			const delays = config.primary.retry_delays_ms;
			for (let attempt = 0; attempt <= delays.length; attempt += 1) {
				if (attempt > 0) await waitAbortable(delays[attempt - 1] ?? 0, ctx.signal);
				if (ctx.signal.aborted) {
					cancelled = true;
					break;
				}
				const outcome = await transcriber.transcribe({
					audio: input.audio.bytes,
					fileName: input.audio.name,
					mimeType: input.audio.mimeType,
					timeoutMs: config.primary.timeout_ms,
					signal: ctx.signal
				});
				if (outcome.status === 'ok') {
					primaryOutcome = 'served';
					served = {
						provider: 'primary',
						text: outcome.text,
						providerSeconds: outcome.audioSeconds,
						model: config.primary.model,
						generationId: null,
						costMicroUsd: null,
						inputTokens: null,
						outputTokens: null,
						truncated: false
					};
					break;
				}
				primaryOutcome = outcome.reason;
				if (outcome.reason === 'aborted') {
					cancelled = true;
					break;
				}
				if (outcome.reason === 'billing') {
					deps.logger.emit('ai.provider.billing_error', {
						provider: 'mistral',
						httpStatus: outcome.httpStatus
					});
					await raiseAlert(deps.alerts, {
						key: alertKeys.mistralBilling(),
						detail: `Error de facturación de Mistral (HTTP ${outcome.httpStatus === null ? 'sin código' : String(outcome.httpStatus)}).`
					});
					break;
				}
				if (attempt < delays.length) {
					deps.logger.emit('ai.provider.retry', {
						operationId,
						provider: 'mistral',
						attempt: attempt + 1,
						httpStatus: outcome.httpStatus,
						errorCode: outcome.reason
					});
				}
			}
		}

		if (served === null && !cancelled && backupAvailable && config.backup !== null) {
			const backup = config.backup;
			const converted = join(dir, 'converted.mp3');
			const conversion = await media.converter.convert(original, converted, {
				format: 'mp3',
				timeoutMs: backup.timeout_ms,
				signal: ctx.signal
			});
			if (conversion.status === 'aborted') {
				cancelled = true;
			} else if (conversion.status !== 'ok') {
				backupOutcome = 'unavailable';
			} else {
				const data = (await readFile(converted)).toString('base64');
				const result = await deps.gateway.chat({
					model: backup.model,
					messages: [
						{
							role: 'user',
							content: [
								{ type: 'text', text: BACKUP_PROMPT },
								{ type: 'input_audio', input_audio: { data, format: 'mp3' } }
							]
						}
					],
					maxTokens: null,
					temperature: 0,
					requireParameters: false,
					appTitle: ctx.appTitle,
					timeoutMs: backup.timeout_ms,
					signal: ctx.signal
				});
				if (result.status === 'ok' && result.text !== null && result.text.length > 0) {
					backupOutcome = 'served';
					served = {
						provider: 'backup',
						text: result.text,
						providerSeconds: null,
						model: result.model,
						generationId: result.generationId,
						costMicroUsd: result.costMicroUsd,
						inputTokens: result.inputTokens,
						outputTokens: result.outputTokens,
						truncated: result.truncated
					};
				} else if (result.status === 'ok') {
					backupOutcome = 'invalid';
				} else if (result.status === 'flagged') {
					backupOutcome = 'invalid';
				} else if (result.reason === 'aborted') {
					cancelled = true;
				} else {
					backupOutcome = result.reason;
				}
			}
		}

		if (cancelled) {
			settleAbandoned(deps, operationId, input.operation, holdId, now, 'cancelled');
			return null;
		}
		if (served === null) {
			immediateTransaction(deps.db, (tx) => {
				updateOperation(tx, operationId, {
					status: 'provider_error',
					errorCode: 'TRANSCRIPTION_FAILED',
					completedAt: now
				});
			});
			if (holdId !== null) deps.credits.release({ holdId, reason: 'released' });
			deps.logger.emit('ai.operation.failed', {
				operationId,
				operation: input.operation,
				errorCode: 'TRANSCRIPTION_FAILED'
			});
			const failure = transcriptionFailure(primaryOutcome, backupOutcome);
			throw new AppError('TRANSCRIPTION_FAILED', {
				primaryError: failure.primaryError,
				backupError: failure.backupError
			});
		}

		// Cobro: solo lo que factura cada proveedor. Voxtral, con sus segundos (o los medidos); el respaldo, con su coste.
		const isPrimary = served.provider === 'primary';
		const billedSeconds = secondsToBill({
			providerSeconds: served.providerSeconds,
			measuredSeconds: seconds
		});
		const billing = await billAndClose(deps, ctx, {
			operationId,
			operation: input.operation,
			holdId,
			replay,
			now,
			holdMicro: holdAmount,
			provider: isPrimary ? 'mistral' : 'openrouter',
			model: served.model,
			usedFallback: !isPrimary,
			inputTokens: served.inputTokens,
			outputTokens: served.outputTokens,
			truncated: served.truncated,
			generationId: served.generationId,
			costMicroUsd: isPrimary
				? voxtralCostMicroUsd({ seconds: billedSeconds, pricePerMinuteMicroUsd: pricePerMinute })
				: served.costMicroUsd,
			audioMs: Math.round(billedSeconds * 1000)
		});
		if (!billing.delivered) {
			deps.logger.emit('ai.operation.cancelled', {
				operationId,
				operation: input.operation,
				status: 'undelivered'
			});
			return null;
		}

		if (!isPrimary)
			deps.logger.emit('ai.transcription.backup_used', { operationId, provider: 'openrouter' });
		deps.logger.emit('ai.operation.completed', {
			operationId,
			operation: input.operation,
			status: 'ok',
			provider: isPrimary ? 'mistral' : 'openrouter'
		});
		const view = deps.credits.getBalance(ctx.userId);
		return {
			text: served.text,
			providerUsed: served.provider,
			audioSeconds: Math.round(billedSeconds),
			operationId,
			chargedMicro: billing.charged,
			balance: {
				totalMicro: view.totalMicro,
				reservedMicro: view.reservedMicro,
				availableMicro: view.availableMicro,
				debtMicro: view.debtMicro
			}
		};
	} catch (error) {
		if (!(error instanceof AppError)) abandonUnexpected(deps, operationId, holdId, now);
		throw error;
	} finally {
		try {
			await rm(dir, { recursive: true, force: true });
		} catch {
			deps.logger.emit('ai.temp_file.cleanup_failed', { operationId });
		}
	}
}

export interface ImageInput {
	readonly operation: string;
	readonly prompt?: string | undefined;
	readonly variables?: Readonly<Record<string, string>> | undefined;
}

/**
 * E09 · imagen. Modo libre (`prompt`) o plantilla (`variables`). El modelo devuelve la imagen como _data URL_, que se
 * entrega sin almacenarla. Mismas reglas de reserva, cobro, idempotencia y cancelación que el chat.
 */
export async function runImage(
	deps: AiDeps,
	ctx: ChatContext,
	input: ImageInput
): Promise<ImageResponseBody | null> {
	// Pasos 6 a 8 de §8: versión, mantenimiento, freno global y frecuencia (FR-069, FR-072, FR-073, FR-074, BE-FR-43).
	guardRequest(protectionsOf(deps), {
		endpoint: 'ai',
		appId: ctx.appId,
		appVersion: ctx.appVersion,
		userId: ctx.userId,
		transcription: false
	});
	const now = toEpochMs(deps.clock.now());
	const { replay } = admissionOf(deps, ctx, input.operation, now);

	const op = chatOperationOf(deps.apps, ctx.appId, input.operation);
	if (op === undefined || !op.active || op.kind !== 'image') {
		reject(deps, input.operation, 'unknown_operation', 'VALIDATION_ERROR', { field: 'operation' });
	}
	const effective = getEffectiveConfig(deps.apps, {
		appId: ctx.appId,
		operationKey: input.operation
	});
	const eop = effective.operation;
	if (eop === null) throw new AppError('INTERNAL_ERROR', { reason: 'operation_missing' });
	const limits: ChatOperationView['limits'] = {
		maxTextChars: eop.limits.max_text_chars,
		maxImageMb: eop.limits.max_image_mb
	};

	let messages: readonly ChatMessage[];
	if (op.mode === 'plantilla') {
		const template = op.template;
		if (template === null) throw new AppError('INTERNAL_ERROR', { reason: 'template_missing' });
		if (input.prompt !== undefined)
			reject(deps, input.operation, 'validation', 'VALIDATION_ERROR', { field: 'prompt' });
		if (input.variables === undefined) {
			reject(deps, input.operation, 'validation', 'VALIDATION_ERROR', { field: 'variables' });
		}
		const defs = toDefs(template);
		const variables = checkVariables(defs, input.variables);
		if (!variables.ok)
			reject(deps, input.operation, 'validation', 'VALIDATION_ERROR', { field: variables.field });
		messages = renderTemplate(template.messages, input.variables, defs);
	} else {
		if (input.variables !== undefined) {
			reject(deps, input.operation, 'validation', 'VALIDATION_ERROR', { field: 'variables' });
		}
		if (input.prompt === undefined)
			reject(deps, input.operation, 'validation', 'VALIDATION_ERROR', { field: 'prompt' });
		messages = [{ role: 'user', content: input.prompt }];
	}
	if (!checkMessageSizes(messages, limits).ok) {
		reject(deps, input.operation, 'payload_too_large', 'PAYLOAD_TOO_LARGE', { field: 'messages' });
	}

	// Coste máximo: el precio por imagen estimado de la operación, o su tope si no lo hay.
	const estimateMicro =
		op.estimatedMaxCostMicroUsd === null
			? op.maxCostMicro
			: chargeFor(deps.pricing, {
					appId: ctx.appId,
					operationKey: input.operation,
					costMicroUsd: op.estimatedMaxCostMicroUsd,
					provider: 'openrouter'
				}).chargeMicro;
	if (!checkMaxCost({ estimatedMicro: estimateMicro, maxMicro: op.maxCostMicro }).ok) {
		const operationId = deps.ids('op');
		immediateTransaction(deps.db, (tx) => {
			insertOperation(
				tx,
				rowOf(ctx, op, operationId, ctx.idempotencyKey, now, 'rejected', 'OPERATION_TOO_EXPENSIVE')
			);
		});
		reject(deps, input.operation, 'operation_too_expensive', 'OPERATION_TOO_EXPENSIVE');
	}

	const operationId = deps.ids('op');
	const holdAmount = Math.max(1, estimateMicro);
	const reserved = immediateTransaction(deps.db, (tx) => {
		insertOperation(tx, rowOf(ctx, op, operationId, ctx.idempotencyKey, now, 'in_progress', null));
		if (replay) return { ok: true as const, holdId: null };
		const outcome = deps.credits.reserve({
			userId: ctx.userId,
			appId: ctx.appId,
			operationId,
			amountMicro: holdAmount
		});
		if (!outcome.ok) {
			updateOperation(tx, operationId, {
				status: 'rejected',
				errorCode: 'INSUFFICIENT_BALANCE',
				completedAt: now
			});
			return { ok: false as const, outcome };
		}
		updateOperation(tx, operationId, { holdMicro: toMicro(holdAmount) });
		return { ok: true as const, holdId: outcome.holdId };
	});
	if (!reserved.ok) {
		const failure = reserved.outcome;
		throw new AppError(
			failure.reason === 'daily_free_limit' ? 'DAILY_FREE_LIMIT_REACHED' : 'INSUFFICIENT_BALANCE',
			failure.reason === 'insufficient_balance'
				? { requiredMicro: failure.requiredMicro, availableMicro: failure.availableMicro }
				: {}
		);
	}
	const holdId = reserved.holdId;
	deps.logger.emit('ai.operation.started', { operationId, operation: input.operation });
	try {
		return await imageAfterReserve(deps, ctx, {
			operation: input.operation,
			eop,
			operationId,
			holdId,
			holdAmount,
			now,
			replay,
			messages,
			temperature: op.temperatureMilli / 1000
		});
	} catch (error) {
		if (!(error instanceof AppError)) abandonUnexpected(deps, operationId, holdId, now);
		throw error;
	}
}

/** Imagen tras la reserva: proveedor con reintentos, validación de la salida y cobro. */
async function imageAfterReserve(
	deps: AiDeps,
	ctx: ChatContext,
	input: {
		readonly operation: string;
		readonly eop: EffectiveOperation;
		readonly operationId: string;
		readonly holdId: string | null;
		readonly holdAmount: number;
		readonly now: EpochMs;
		readonly replay: boolean;
		readonly messages: readonly ChatMessage[];
		readonly temperature: number;
	}
): Promise<ImageResponseBody | null> {
	const { operationId, holdId, now, replay, messages, eop } = input;
	const result = await callProvider(deps, ctx, operationId, eop, {
		messages,
		maxTokens: null,
		temperature: input.temperature,
		modalities: ['image'],
		requireParameters: false,
		appTitle: ctx.appTitle
	});
	if (result.kind === 'cancelled') {
		settleAbandoned(deps, operationId, input.operation, holdId, now, 'cancelled');
		return null;
	}
	if (result.kind === 'flagged') {
		await settleFlagged(deps, ctx, operationId, input.operation, holdId, now);
	}
	if (result.kind === 'failed') {
		settleFailed(deps, operationId, input.operation, holdId, now, result.code);
	}
	if (result.kind !== 'ok') return null;

	const { outcome, attempt } = result;
	if (outcome.imageDataUrl === null) {
		deps.logger.emit('ai.provider.invalid_response', {
			operationId,
			provider: 'openrouter',
			model: outcome.model,
			reason: 'empty'
		});
		settleFailed(deps, operationId, input.operation, holdId, now, 'PROVIDER_ERROR');
	}

	const billing = await billAndClose(deps, ctx, {
		operationId,
		operation: input.operation,
		holdId,
		replay,
		now,
		holdMicro: input.holdAmount,
		provider: 'openrouter',
		model: outcome.model,
		usedFallback: attempt.isFallback,
		inputTokens: outcome.inputTokens,
		outputTokens: outcome.outputTokens,
		truncated: false,
		generationId: outcome.generationId,
		costMicroUsd: outcome.costMicroUsd,
		audioMs: null
	});
	if (!billing.delivered) {
		deps.logger.emit('ai.operation.cancelled', {
			operationId,
			operation: input.operation,
			status: 'undelivered'
		});
		return null;
	}
	deps.logger.emit('ai.operation.completed', {
		operationId,
		operation: input.operation,
		status: 'ok',
		provider: 'openrouter'
	});
	const view = deps.credits.getBalance(ctx.userId);
	return {
		imageDataUrl: outcome.imageDataUrl,
		operationId,
		chargedMicro: billing.charged,
		balance: {
			totalMicro: view.totalMicro,
			reservedMicro: view.reservedMicro,
			availableMicro: view.availableMicro,
			debtMicro: view.debtMicro
		}
	};
}
