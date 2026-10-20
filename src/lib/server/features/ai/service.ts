// Servicio de `ai` (BE-FR-17, BE-FR-21, BE-FR-30–34, BE-FR-37, BE-FR-71, BE-FR-72, BE-FR-79–82; FR-027–FR-033, FR-059,
// FR-061, FR-063; T166–T171). El flujo de §8: comprobaciones, idempotencia, validación, coste máximo, reserva en la
// transacción 1, llamada al proveedor fuera de cualquier transacción, y cobro y liberación en la transacción 2.
import type { Clock } from '$lib/server/adapters/clock/clock';
import type { AiGateway, ChatOutcome, ChatRequest } from '$lib/server/adapters/openrouter/gateway';
import type { Db } from '$lib/server/db/client';
import { immediateTransaction, type Tx } from '$lib/server/db/tx';
import {
	chatOperationOf,
	getEffectiveConfig,
	getSetting,
	type AppsDeps,
	type ChatOperation,
	type EffectiveOperation
} from '$lib/server/features/apps';
import { pendingAcceptancesOf } from '$lib/server/features/legal';
import type { Credits } from '$lib/server/features/credits';
import {
	chargeFor,
	checkMaxCost,
	estimateChatMicroUsd,
	type PricingDeps
} from '$lib/server/features/pricing';
import {
	alertKeys,
	raiseAlert,
	sendAccountEmail,
	type AlertDeps,
	type NotificationsDeps
} from '$lib/server/features/notifications';
import { emailOfUser } from '$lib/server/features/accounts';
import {
	guardRequest,
	type ProtectionsDeps,
	type ProtectionsRuntime
} from '$lib/server/features/protections';
import { CHAT_RETRY_WAITS_MS } from '$lib/server/features/apps';
import type { Logger } from '$lib/server/logging/logger';
import { AppError, type ErrorCode } from '$lib/server/shared/errors';
import type { IdGenerator } from '$lib/server/shared/ids';
import { civilDateOf, startOfMadridDay } from '$lib/shared/dates';
import { toMicro, toMicroUsd } from '$lib/shared/money';
import { toEpochMs, type EpochMs } from '$lib/shared/time';
import type { ChatRequestBody, ChatResponseBody } from './contract';
import { decideIdempotency, type IdempotencyDecision } from './domain/idempotency';
import { planAttempts, type PlannedAttempt } from './domain/fallback';
import {
	charCountOf,
	checkChatInput,
	checkMessageSizes,
	imageCountOf,
	type ChatOperationView
} from './domain/chat-input';
import type { OperationStatus } from './domain/operation-state';
import {
	checkVariables,
	renderTemplate,
	type ChatMessage,
	type TemplateVariableDef
} from './domain/template-variables';
import type { AiLogFields } from './events';
import {
	countFlaggedSince,
	insertOperation,
	interruptInProgress,
	lastOperationByKey,
	pricesOf,
	replaceModelCache,
	updateOperation,
	type OperationInsert,
	type OperationPatch,
	realCostByUserOfDay
} from './repository';

/**
 * Reintentos del principal y esperas entre ellos (BE-FR-77 CA4). El tiempo máximo de cada intento es el `timeout_ms` de
 * la operación (45 s por defecto); el total de la operación es la suma de sus intentos y esperas, que `/app/status`
 * informa. No es un tope: si el principal falla, el respaldo corre con su propio tiempo.
 */
export interface RetryPolicy {
	readonly retries: number;
	readonly waitsMs: readonly number[];
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = Object.freeze({
	retries: 1,
	waitsMs: CHAT_RETRY_WAITS_MS
});

/** Tope de salida cuando la operación no fija `max_output_tokens`. Solo sirve para estimar el coste máximo. */
const DEFAULT_MAX_OUTPUT_TOKENS = 4_096;

export interface AiDeps {
	readonly db: Db;
	/** Avisos por email (saldo bajo, BE-FR-49.7). Opcional solo en los montajes de prueba; la composición siempre lo da. */
	readonly notifications?: NotificationsDeps;
	readonly logger: Logger;
	readonly clock: Clock;
	readonly ids: IdGenerator;
	readonly apps: AppsDeps;
	readonly credits: Credits;
	readonly pricing: PricingDeps;
	readonly gateway: AiGateway;
	readonly alerts: AlertDeps;
	readonly retry?: RetryPolicy;
	/** Estado en memoria de frecuencia y concurrencia (T200), uno por proceso. */
	readonly protections: ProtectionsRuntime;
}

/** Dependencias de `protections` a partir de las de `ai`: el coste diario sale de la tabla de operaciones de `ai`. */
export function protectionsOf(deps: AiDeps): ProtectionsDeps {
	return {
		db: deps.db,
		clock: deps.clock,
		logger: deps.logger,
		apps: deps.apps,
		credits: deps.credits,
		alerts: deps.alerts,
		dailyCosts: {
			costByUserOfDay: (from, until) => realCostByUserOfDay(deps.db, from, until)
		},
		runtime: deps.protections
	};
}

/** Contexto de la petición: quién llama, desde qué app, la señal de desconexión y la clave de idempotencia. */
export interface ChatContext {
	readonly userId: string;
	readonly appId: string;
	readonly appTitle: string;
	readonly sessionId: string | null;
	readonly appVersion: string | null;
	readonly idempotencyKey: string | null;
	readonly signal: AbortSignal;
}

type RejectReason = AiLogFields['ai.operation.rejected']['reason'];

export function numberSetting(deps: AiDeps, key: Parameters<typeof getSetting>[1]): number {
	const value = getSetting(deps.apps, key);
	if (typeof value !== 'number')
		throw new AppError('INTERNAL_ERROR', { reason: 'settings_missing' });
	return value;
}

/** Rechazo antes de llamar al proveedor (`ai.operation.rejected`, sin cobro). Nunca devuelve. */
export function reject(
	deps: AiDeps,
	operation: string,
	reason: RejectReason,
	code: ErrorCode,
	details: Readonly<Record<string, unknown>> = {}
): never {
	deps.logger.emit('ai.operation.rejected', { operation, reason });
	throw new AppError(code, details);
}

export function toDefs(template: NonNullable<ChatOperation['template']>): TemplateVariableDef[] {
	return template.variables.map((variable) => ({
		name: variable.name,
		type: variable.type,
		required: variable.required,
		...(variable.max_chars !== undefined ? { maxChars: variable.max_chars } : {}),
		...(variable.max_mb !== undefined ? { maxMb: variable.max_mb } : {})
	}));
}

function viewOf(
	op: ChatOperation,
	limits: EffectiveOperation['limits'],
	appId: string
): ChatOperationView {
	return {
		appId,
		active: op.active,
		kind: op.kind,
		mode: op.mode,
		capabilities: op.capabilities,
		limits: { maxTextChars: limits.max_text_chars, maxImageMb: limits.max_image_mb }
	};
}

/** Coste en micro-USD de los tokens reales con el precio del modelo que respondió, redondeado hacia arriba. */
function tokenCostMicroUsd(
	tokens: { readonly input: number; readonly output: number },
	price: { readonly inputPerMTokMicroUsd: number; readonly outputPerMTokMicroUsd: number }
): number {
	return Math.ceil(
		(tokens.input * price.inputPerMTokMicroUsd + tokens.output * price.outputPerMTokMicroUsd) /
			1_000_000
	);
}

/** Espera de reintento que se interrumpe si el cliente se va. */
export function waitAbortable(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		if (signal.aborted) {
			resolve();
			return;
		}
		const timer = setTimeout(resolve, ms);
		signal.addEventListener(
			'abort',
			() => {
				clearTimeout(timer);
				resolve();
			},
			{ once: true }
		);
	});
}

export type ProviderOk = Extract<ChatOutcome, { status: 'ok' }>;
export type ProviderResult =
	| { readonly kind: 'ok'; readonly outcome: ProviderOk; readonly attempt: PlannedAttempt }
	| { readonly kind: 'flagged' }
	| { readonly kind: 'cancelled' }
	| { readonly kind: 'failed'; readonly code: 'PROVIDER_ERROR' | 'PROVIDER_TIMEOUT' };

/** Intentos del principal y después cada respaldo, en orden y dentro del tiempo total de la operación (BE-FR-77 CA4). */
export async function callProvider(
	deps: AiDeps,
	ctx: ChatContext,
	operationId: string,
	op: EffectiveOperation,
	request: Omit<ChatRequest, 'model' | 'timeoutMs' | 'signal'>
): Promise<ProviderResult> {
	const policy = deps.retry ?? DEFAULT_RETRY_POLICY;
	if (op.model === null) throw new AppError('INTERNAL_ERROR', { reason: 'model_missing' });
	const attempts = planAttempts({
		primary: op.model,
		fallbacks: op.fallbackModels,
		retries: policy.retries,
		waitsMs: policy.waitsMs,
		attemptTimeoutMs: op.timeoutMs,
		fallbackTimeoutMs: op.timeoutMs
	});
	let lastCode: 'PROVIDER_ERROR' | 'PROVIDER_TIMEOUT' = 'PROVIDER_ERROR';
	for (const [index, attempt] of attempts.entries()) {
		if (index > 0) await waitAbortable(attempt.waitBeforeMs, ctx.signal);
		if (ctx.signal.aborted) return { kind: 'cancelled' };
		if (attempt.isFallback && !attempts[index - 1]?.isFallback) {
			deps.logger.emit('ai.provider.fallback', {
				operationId,
				provider: 'openrouter',
				model: attempt.model,
				attempt: index + 1
			});
		}
		const result = await deps.gateway.chat({
			...request,
			model: attempt.model,
			timeoutMs: attempt.timeoutMs,
			signal: ctx.signal
		});
		if (result.status === 'ok') return { kind: 'ok', outcome: result, attempt };
		if (result.status === 'flagged') return { kind: 'flagged' };
		if (result.reason === 'aborted') return { kind: 'cancelled' };
		lastCode = result.reason === 'timeout' ? 'PROVIDER_TIMEOUT' : 'PROVIDER_ERROR';
		if (index < attempts.length - 1) {
			deps.logger.emit('ai.provider.retry', {
				operationId,
				provider: 'openrouter',
				attempt: index + 1,
				httpStatus: result.httpStatus,
				errorCode: result.reason
			});
		}
	}
	return { kind: 'failed', code: lastCode };
}

/** Fila de una operación que no llega a llamar al proveedor (rechazo) o que empieza (`in_progress`). */
export function rowOf(
	ctx: ChatContext,
	op: ChatOperation,
	id: string,
	key: string | null,
	now: EpochMs,
	status: OperationStatus,
	errorCode: string | null
): OperationInsert {
	return {
		id,
		userId: ctx.userId,
		appId: ctx.appId,
		sessionId: ctx.sessionId,
		appOperationId: op.id,
		promptTemplateId: op.template?.id ?? null,
		status,
		idempotencyKey: key,
		provider: null,
		model: null,
		usedFallback: false,
		costMicroUsd: toMicroUsd(0),
		costEstimated: false,
		holdMicro: null,
		chargedMicro: toMicro(0),
		absorbedMicro: toMicro(0),
		absorbedReason: null,
		truncated: false,
		flagged: false,
		appVersion: ctx.appVersion,
		errorCode,
		createdAt: now,
		completedAt: status === 'in_progress' ? null : now
	};
}

/**
 * Pasos 9 y 10 de §8: documentos legales pendientes (TERMS_ACCEPTANCE_REQUIRED) e idempotencia (BE-FR-81). Lanza si la
 * petición no puede seguir; si sigue, devuelve si es la repetición de una operación no entregada (sin cobro).
 */
export function admissionOf(
	deps: AiDeps,
	ctx: ChatContext,
	operation: string,
	now: EpochMs
): { readonly replay: boolean } {
	const key = ctx.idempotencyKey;

	// Documentos legales pendientes (TERMS_ACCEPTANCE_REQUIRED).
	const pending = pendingAcceptancesOf(deps.db, ctx.userId, now);
	if (pending.length > 0) {
		deps.logger.emit('legal.acceptance.required', { count: pending.length });
		throw new AppError('TERMS_ACCEPTANCE_REQUIRED', {
			pending: pending.map((item) => ({ document: item.document, version: item.version }))
		});
	}

	// Idempotencia
	const windowMs = numberSetting(deps, 'idempotency_window_minutes') * 60_000;
	const last =
		key === null
			? undefined
			: lastOperationByKey(deps.db, {
					userId: ctx.userId,
					key,
					since: toEpochMs(now - windowMs)
				});
	const decision: IdempotencyDecision = decideIdempotency({
		key,
		last:
			last === undefined
				? undefined
				: { status: last.status, createdAt: last.createdAt, operationId: last.id },
		now,
		windowMs
	});
	if (decision.action === 'in_progress') {
		reject(deps, operation, 'request_in_progress', 'REQUEST_IN_PROGRESS');
	}
	if (decision.action === 'duplicate') {
		reject(deps, operation, 'duplicate_request', 'DUPLICATE_REQUEST', {
			operationId: decision.operationId
		});
	}
	const replayOfUndelivered = decision.replayOfUndelivered;
	if (replayOfUndelivered && last !== undefined) {
		deps.logger.emit('ai.idempotency.replayed', {
			operationId: last.id,
			reason: 'undelivered_retry'
		});
	}

	return { replay: replayOfUndelivered };
}

/**
 * Chat (E07). Devuelve la respuesta, o `null` si el cliente se fue antes de recibirla: la operación queda `cancelled`
 * (sin cobro) o `undelivered` (cobrada, porque el proveedor ya había respondido).
 */
export async function runChat(
	deps: AiDeps,
	ctx: ChatContext,
	body: ChatRequestBody
): Promise<ChatResponseBody | null> {
	// Pasos 6 a 8 de §8: versión, mantenimiento, freno global y frecuencia (FR-069, FR-072, FR-073, FR-074, BE-FR-43).
	guardRequest(protectionsOf(deps), {
		endpoint: 'ai',
		appId: ctx.appId,
		appVersion: ctx.appVersion,
		userId: ctx.userId,
		transcription: false
	});
	const now = toEpochMs(deps.clock.now());
	const key = ctx.idempotencyKey;

	// Pasos 9 y 10: documentos legales e idempotencia (compartido con la transcripción y la imagen).
	const { replay } = admissionOf(deps, ctx, body.operation, now);

	// Paso 11: la operación existe, está activa y es de chat. Sin fila si no es válida.
	const op = chatOperationOf(deps.apps, ctx.appId, body.operation);
	if (op === undefined || !op.active || op.kind !== 'chat') {
		reject(deps, body.operation, 'unknown_operation', 'VALIDATION_ERROR', { field: 'operation' });
	}
	const effective = getEffectiveConfig(deps.apps, {
		appId: ctx.appId,
		operationKey: body.operation
	});
	const eop = effective.operation;
	if (eop === null) throw new AppError('INTERNAL_ERROR', { reason: 'operation_missing' });
	const view = viewOf(op, eop.limits, ctx.appId);

	const check = checkChatInput({
		operation: view,
		appId: ctx.appId,
		body: {
			messages: body.messages,
			variables: body.variables,
			response_format: body.response_format,
			tools: body.tools,
			tool_choice: body.tool_choice
		}
	});
	if (!check.ok) {
		reject(
			deps,
			body.operation,
			check.code === 'PAYLOAD_TOO_LARGE' ? 'payload_too_large' : 'validation',
			check.code,
			{ field: check.field }
		);
	}

	let messages: readonly ChatMessage[];
	let responseFormat: unknown;
	let tools: unknown;
	let toolChoice: unknown;
	if (op.mode === 'plantilla') {
		const template = op.template;
		if (template === null) throw new AppError('INTERNAL_ERROR', { reason: 'template_missing' });
		const defs = toDefs(template);
		const values = body.variables ?? {};
		const variables = checkVariables(defs, values);
		if (!variables.ok) {
			reject(deps, body.operation, 'validation', 'VALIDATION_ERROR', { field: variables.field });
		}
		messages = renderTemplate(template.messages, values, defs);
		if (!checkMessageSizes(messages, view.limits).ok) {
			reject(deps, body.operation, 'payload_too_large', 'PAYLOAD_TOO_LARGE', { field: 'messages' });
		}
		responseFormat = template.responseFormat ?? undefined;
		tools = template.tools?.tools;
	} else {
		messages = body.messages ?? [];
		responseFormat = body.response_format;
		tools = body.tools;
		toolChoice = body.tool_choice;
	}

	// Coste máximo (paso 13, BE-FR-72): precio más caro entre el principal y los respaldos, en micro-USD y luego en µc.
	const modelIds = [eop.model, ...eop.fallbackModels].filter((id): id is string => id !== null);
	const prices = [...pricesOf(deps.db, modelIds).values()];
	const estimatedUsd =
		prices.length > 0
			? estimateChatMicroUsd({
					charCount: charCountOf(messages),
					imageCount: imageCountOf(messages),
					charsPerToken: numberSetting(deps, 'chars_per_token_estimate'),
					imageTokens: numberSetting(deps, 'image_input_token_estimate'),
					maxOutputTokens: eop.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
					models: prices
				})
			: op.estimatedMaxCostMicroUsd;
	const estimateMicro =
		estimatedUsd === null
			? eop.maxCostMicro
			: chargeFor(deps.pricing, {
					appId: ctx.appId,
					operationKey: body.operation,
					costMicroUsd: estimatedUsd,
					provider: 'openrouter'
				}).chargeMicro;
	if (!checkMaxCost({ estimatedMicro: estimateMicro, maxMicro: eop.maxCostMicro }).ok) {
		immediateTransaction(deps.db, (tx) => {
			insertOperation(
				tx,
				rowOf(ctx, op, deps.ids('op'), key, now, 'rejected', 'OPERATION_TOO_EXPENSIVE')
			);
		});
		reject(deps, body.operation, 'operation_too_expensive', 'OPERATION_TOO_EXPENSIVE');
	}

	// Transacción 1: fila `in_progress` y reserva del coste máximo (BE-FR-71). Una repetición tras `undelivered` no
	// reserva: su coste queda absorbido (BE-FR-81 CA1). Sin saldo, la fila queda `rejected` y no hay reserva.
	const operationId = deps.ids('op');
	const holdAmount = Math.max(1, estimateMicro);
	const reserved = immediateTransaction(deps.db, (tx) => {
		insertOperation(tx, rowOf(ctx, op, operationId, key, now, 'in_progress', null));
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
		// El rechazo por saldo lo registra `credits` (`credits.hold.rejected`); el contrato no lo lista como rechazo de ai.
		const failure = reserved.outcome;
		const details =
			failure.reason === 'insufficient_balance'
				? { requiredMicro: failure.requiredMicro, availableMicro: failure.availableMicro }
				: {};
		throw new AppError(
			failure.reason === 'daily_free_limit' ? 'DAILY_FREE_LIMIT_REACHED' : 'INSUFFICIENT_BALANCE',
			details
		);
	}
	deps.logger.emit('ai.operation.started', { operationId, operation: body.operation });

	// Proveedor, fuera de cualquier transacción. Un fallo inesperado libera la reserva antes de propagarse; los fallos
	// esperados (cancelación, moderación, todos los intentos) los cierra su propio `settle…`.
	let result: ProviderResult;
	try {
		result = await callProvider(deps, ctx, operationId, eop, {
			messages,
			maxTokens: eop.maxOutputTokens,
			temperature: op.temperatureMilli / 1000,
			responseFormat,
			tools,
			toolChoice,
			...(op.preferredProvider !== null ? { order: [op.preferredProvider] } : {}),
			requireParameters: responseFormat !== undefined || tools !== undefined,
			appTitle: ctx.appTitle
		});
	} catch (error) {
		abandonUnexpected(deps, operationId, reserved.holdId, now);
		throw error;
	}
	if (result.kind === 'cancelled') {
		settleAbandoned(deps, operationId, body.operation, reserved.holdId, now, 'cancelled');
		return null;
	}
	if (result.kind === 'flagged') {
		await settleFlagged(deps, ctx, operationId, body.operation, reserved.holdId, now);
	}
	if (result.kind === 'failed') {
		settleFailed(deps, operationId, body.operation, reserved.holdId, now, result.code);
	}
	if (result.kind !== 'ok') return null;
	return await settleOk(deps, ctx, {
		operationId,
		operation: body.operation,
		holdId: reserved.holdId,
		replay,
		now,
		result,
		holdMicro: holdAmount,
		responseFormat: responseFormat !== undefined
	});
}

/** Fallo inesperado tras reservar: libera la reserva y deja la fila como error interno, sin cobro. */
export function abandonUnexpected(
	deps: AiDeps,
	operationId: string,
	holdId: string | null,
	now: EpochMs
): void {
	immediateTransaction(deps.db, (tx) => {
		updateOperation(tx, operationId, {
			status: 'provider_error',
			errorCode: 'INTERNAL_ERROR',
			completedAt: now
		});
	});
	if (holdId !== null) deps.credits.release({ holdId, reason: 'released' });
}

/** Cancelada antes de la respuesta del proveedor: sin cobro, reserva liberada, y el evento (BE-FR-37 CA1, D-05). */
export function settleAbandoned(
	deps: AiDeps,
	operationId: string,
	operation: string,
	holdId: string | null,
	now: EpochMs,
	status: 'cancelled'
): void {
	immediateTransaction(deps.db, (tx) => {
		updateOperation(tx, operationId, { status, completedAt: now });
	});
	if (holdId !== null) deps.credits.release({ holdId, reason: 'released' });
	deps.logger.emit('ai.operation.cancelled', { operationId, operation, status });
}

/** Moderación del proveedor: operación marcada sin contenido ni cobro. Aviso al umbral diario (FR-061, BE-FR-82). */
export async function settleFlagged(
	deps: AiDeps,
	ctx: ChatContext,
	operationId: string,
	operation: string,
	holdId: string | null,
	now: EpochMs
): Promise<never> {
	immediateTransaction(deps.db, (tx) => {
		updateOperation(tx, operationId, {
			status: 'provider_error',
			flagged: true,
			errorCode: 'PROVIDER_ERROR',
			completedAt: now
		});
	});
	if (holdId !== null) deps.credits.release({ holdId, reason: 'released' });
	deps.logger.emit('ai.operation.flagged', { operationId, operation, provider: 'openrouter' });

	const count = countFlaggedSince(deps.db, ctx.userId, startOfMadridDay(now));
	if (count === numberSetting(deps, 'flagged_ops_alert_per_day')) {
		deps.logger.emit('ai.flagged.threshold_reached', { count });
		await raiseAlert(deps.alerts, {
			key: alertKeys.flagged(ctx.userId, civilDateOf(now)),
			detail: String(count)
		});
	}
	throw new AppError('PROVIDER_ERROR');
}

/** Todos los intentos fallaron: sin cobro, reserva liberada, y el error genérico que ve el cliente. */
export function settleFailed(
	deps: AiDeps,
	operationId: string,
	operation: string,
	holdId: string | null,
	now: EpochMs,
	code: 'PROVIDER_ERROR' | 'PROVIDER_TIMEOUT'
): never {
	immediateTransaction(deps.db, (tx) => {
		updateOperation(tx, operationId, {
			status: 'provider_error',
			errorCode: code,
			completedAt: now
		});
	});
	if (holdId !== null) deps.credits.release({ holdId, reason: 'released' });
	deps.logger.emit('ai.operation.failed', { operationId, operation, errorCode: code });
	throw new AppError(code);
}

interface SettleOk {
	readonly operationId: string;
	readonly operation: string;
	readonly holdId: string | null;
	readonly replay: boolean;
	readonly now: EpochMs;
	readonly result: Extract<ProviderResult, { kind: 'ok' }>;
	readonly holdMicro: number;
	readonly responseFormat: boolean;
}

/** Datos de una operación servida que hay que cobrar y cerrar (compartido por el chat, la transcripción y la imagen). */
export interface BillingInput {
	readonly operationId: string;
	readonly operation: string;
	readonly holdId: string | null;
	readonly replay: boolean;
	readonly now: EpochMs;
	/** Reserva de la operación, que se usa si no hay coste conocido ni precio del modelo. */
	readonly holdMicro: number;
	readonly provider: 'openrouter' | 'mistral';
	readonly model: string;
	readonly usedFallback: boolean;
	readonly inputTokens: number | null;
	readonly outputTokens: number | null;
	readonly truncated: boolean;
	readonly generationId: string | null;
	/** Coste real en micro-USD si lo conoce el llamante (Voxtral, o la respuesta del proveedor); `null` si hay que buscarlo. */
	readonly costMicroUsd: number | null;
	readonly audioMs: number | null;
}

/**
 * Cobra y cierra una operación servida: coste real (el dado, `/generation`, o la estimación por el precio del modelo),
 * cobro y liberación de la reserva en la transacción 2, y cierre de la fila. Una repetición tras `undelivered` no cobra:
 * absorbe el coste (BE-FR-81 CA1). `delivered` es falso si el cliente se fue; la operación queda `undelivered` y cobrada.
 */
export async function billAndClose(
	deps: AiDeps,
	ctx: ChatContext,
	input: BillingInput
): Promise<{
	readonly delivered: boolean;
	readonly charged: number;
	readonly lowBalance: 'notified' | 'rearmed' | null;
}> {
	const delivered = !ctx.signal.aborted;
	const status: OperationStatus = delivered ? 'ok' : 'undelivered';

	let costMicroUsd = input.costMicroUsd;
	if (costMicroUsd === null && input.generationId !== null) {
		costMicroUsd = await deps.gateway.generationCostMicroUsd(
			input.generationId,
			AbortSignal.timeout(10_000)
		);
	}
	let costEstimated = false;
	if (
		costMicroUsd === null &&
		input.provider === 'openrouter' &&
		input.inputTokens !== null &&
		input.outputTokens !== null
	) {
		const price = pricesOf(deps.db, [input.model]).get(input.model);
		if (price !== undefined) {
			costEstimated = true;
			costMicroUsd = tokenCostMicroUsd(
				{ input: input.inputTokens, output: input.outputTokens },
				price
			);
			deps.logger.emit('ai.cost.estimated', {
				operationId: input.operationId,
				provider: 'openrouter',
				model: input.model
			});
		}
	}
	const priced =
		costMicroUsd === null
			? null
			: chargeFor(deps.pricing, {
					appId: ctx.appId,
					operationKey: input.operation,
					costMicroUsd,
					provider: input.provider
				});
	// Sin coste conocido ni precio del modelo, se cobra la reserva: es el máximo que se había acordado.
	const chargeMicro = priced?.chargeMicro ?? input.holdMicro;
	const fxRateId = priced?.fxRateId ?? null;

	// Transacción 2: cobro y liberación de la reserva, y cierre de la fila. Una repetición tras `undelivered` absorbe.
	const settled = immediateTransaction(deps.db, (tx: Tx) => {
		let lowBalance: 'notified' | 'rearmed' | null = null;
		let charged = 0;
		let absorbed = 0;
		let absorbedReason: 'undelivered_replay' | null = null;
		if (input.replay) {
			absorbed = chargeMicro;
			absorbedReason = 'undelivered_replay';
		} else if (input.holdId !== null) {
			const charge = deps.credits.chargeAndRelease({
				holdId: input.holdId,
				realCostMicro: chargeMicro
			});
			if (!charge.ok) throw new AppError('INTERNAL_ERROR', { reason: 'hold_not_open' });
			lowBalance = charge.lowBalance;
			charged = charge.chargedMicro;
			absorbed = charge.absorbedMicro;
		}
		const patch: OperationPatch = {
			status,
			provider: input.provider,
			model: input.model,
			usedFallback: input.usedFallback,
			inputTokens: input.inputTokens,
			outputTokens: input.outputTokens,
			audioMs: input.audioMs,
			costMicroUsd: toMicroUsd(costMicroUsd ?? 0),
			costEstimated,
			fxRateId,
			chargedMicro: toMicro(charged),
			absorbedMicro: toMicro(absorbed),
			absorbedReason,
			truncated: input.truncated,
			providerGenerationId: input.generationId,
			completedAt: input.now,
			errorCode: null
		};
		updateOperation(tx, input.operationId, patch);
		return { charged, lowBalance };
	});
	if (settled.lowBalance === 'notified') await notifyLowBalance(deps, ctx.userId, input.now);
	return { delivered, charged: settled.charged, lowBalance: settled.lowBalance };
}

/**
 * Aviso de saldo bajo por email (BE-FR-49.7). Se envía después de confirmar el cobro: nunca dentro de su transacción. Un fallo del
 * proveedor no revierte nada (el estado ya quedó guardado); el aviso se registra como no enviado.
 */
export async function notifyLowBalance(
	deps: Pick<AiDeps, 'db' | 'notifications'>,
	userId: string,
	now: EpochMs
): Promise<void> {
	if (deps.notifications === undefined) return;
	const to = emailOfUser(deps.db, userId);
	if (to === null) return;
	await sendAccountEmail(deps.notifications, {
		reason: 'low_balance',
		to,
		idempotencyKey: `low-balance:${userId}:${String(now)}`
	});
}

/**
 * Respuesta del chat servida: cobro con `billAndClose`, salida con el texto y, con esquema, el JSON y su validez. Una
 * respuesta no válida se cobra igual (BE-FR-79 CA1). Si el cliente se fue, no hay respuesta.
 */
async function settleOk(
	deps: AiDeps,
	ctx: ChatContext,
	input: SettleOk
): Promise<ChatResponseBody | null> {
	const { outcome, attempt } = input.result;
	// El cobro es atómico: si falla, no hay cobro y la reserva sigue abierta, así que se libera como en el resto de fallos
	// inesperados en lugar de quedar retenida hasta el reinicio.
	let billing: Awaited<ReturnType<typeof billAndClose>>;
	try {
		billing = await billAndClose(deps, ctx, {
			operationId: input.operationId,
			operation: input.operation,
			holdId: input.holdId,
			replay: input.replay,
			now: input.now,
			holdMicro: input.holdMicro,
			provider: 'openrouter',
			model: outcome.model,
			usedFallback: attempt.isFallback,
			inputTokens: outcome.inputTokens,
			outputTokens: outcome.outputTokens,
			truncated: outcome.truncated,
			generationId: outcome.generationId,
			costMicroUsd: outcome.costMicroUsd,
			audioMs: null
		});
	} catch (error) {
		abandonUnexpected(deps, input.operationId, input.holdId, input.now);
		throw error;
	}

	if (!billing.delivered) {
		deps.logger.emit('ai.operation.cancelled', {
			operationId: input.operationId,
			operation: input.operation,
			status: 'undelivered'
		});
		return null;
	}

	// Salida: el texto y, con esquema, el JSON y su validez.
	let json: unknown = null;
	let structuredValid: boolean | null = null;
	if (input.responseFormat) {
		if (outcome.text === null || outcome.text.length === 0) {
			structuredValid = false;
			deps.logger.emit('ai.provider.invalid_response', {
				operationId: input.operationId,
				provider: 'openrouter',
				model: outcome.model,
				reason: 'empty'
			});
		} else {
			try {
				json = JSON.parse(outcome.text);
				structuredValid = true;
			} catch {
				structuredValid = false;
				deps.logger.emit('ai.provider.invalid_response', {
					operationId: input.operationId,
					provider: 'openrouter',
					model: outcome.model,
					reason: 'schema_invalid'
				});
			}
		}
	}
	const reason = outcome.truncated
		? 'truncated'
		: structuredValid === false
			? 'structured_invalid'
			: undefined;
	deps.logger.emit('ai.operation.completed', {
		operationId: input.operationId,
		operation: input.operation,
		status: 'ok',
		...(reason !== undefined ? { reason } : {}),
		provider: 'openrouter'
	});

	const view = deps.credits.getBalance(ctx.userId);
	return {
		text: outcome.text,
		json,
		structuredValid,
		toolCalls: outcome.toolCalls.length > 0 ? [...outcome.toolCalls] : null,
		truncated: outcome.truncated,
		operationId: input.operationId,
		chargedMicro: billing.charged,
		balance: {
			totalMicro: view.totalMicro,
			reservedMicro: view.reservedMicro,
			availableMicro: view.availableMicro,
			debtMicro: view.debtMicro
		}
	};
}

/** Arranque: las operaciones que quedaron en curso pasan a `interrupted`, sin cobro (FR-028, BE-FR-71). */
export function interruptOperationsOnStartup(deps: AiDeps): number {
	const count = immediateTransaction(deps.db, (tx) =>
		interruptInProgress(tx, toEpochMs(deps.clock.now()))
	);
	if (count > 0) deps.logger.emit('ai.operation.interrupted', { count });
	return count;
}

/** Actualiza la caché del catálogo con la última lectura del proveedor (BE-FR-80). */
export async function refreshModelCache(deps: AiDeps): Promise<'refreshed' | 'unavailable'> {
	const entries = await deps.gateway.listModels(AbortSignal.timeout(20_000));
	if (entries === null) return 'unavailable';
	const now = toEpochMs(deps.clock.now());
	immediateTransaction(deps.db, (tx) => {
		replaceModelCache(
			tx,
			entries.map((entry) => ({
				modelId: entry.id,
				pricing: {
					inputPerMTokMicroUsd: entry.inputPerMTokMicroUsd,
					outputPerMTokMicroUsd: entry.outputPerMTokMicroUsd
				},
				modalities: entry.inputModalities,
				supportedParameters: entry.supportedParameters
			})),
			now
		);
	});
	deps.logger.emit('ai.models.refreshed', { provider: 'openrouter', count: entries.length });
	return 'refreshed';
}
