// Flujo de chat de §8 contra SQLite real y el doble de OpenRouter (api-v1 E07, FR-027–FR-033, BE-FR-17, BE-FR-21; T174).
// Cobro de 776.480 µc con los valores por defecto (api-v1 7.3), saldo, rechazos antes de la reserva, respaldos, tiempo
// total, moderación, coste no informado, salida estructurada y el arranque que interrumpe las operaciones en curso.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FAKE_OK } from '$lib/server/adapters/openrouter/fake';
import { toEpochMs } from '$lib/shared/time';
import { modelCache } from './schema';
import { aiOperations } from './schema';
import { appOperations } from '$lib/server/features/apps/schema';
import { updateSetting } from '$lib/server/features/apps';
import { insertAdmin } from '../../../../../tests/builders/apps';
import { interruptOperationsOnStartup } from './service';
import { runChat } from './service';
import {
	chatBody,
	chatFixture,
	WELCOME_MICRO,
	type ChatFixture
} from '../../../../../tests/builders/chat';
import { insertInFlightOperation } from '../../../../../tests/builders/ai-operations';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { and } from 'drizzle-orm';
import type { ChatResponseBody } from './contract';

const CHARGE_MICRO = 776_480;

let f: ChatFixture;

beforeEach(() => {
	f = chatFixture();
});

afterEach(() => {
	f.close();
});

function rowsOf() {
	return f.base.db.select().from(aiOperations).all();
}

function setCapabilities(capabilities: {
	image_input: boolean;
	structured_output: boolean;
	tools: boolean;
}) {
	f.base.db
		.update(appOperations)
		.set({ capabilities })
		.where(and(eq(appOperations.appId, SEEDED_APP_ID), eq(appOperations.key, 'improve')))
		.run();
}

function priceModel(modelId: string, inputPerMTok: number, outputPerMTok: number) {
	f.base.db
		.insert(modelCache)
		.values({
			modelId,
			pricing: { inputPerMTokMicroUsd: inputPerMTok, outputPerMTokMicroUsd: outputPerMTok },
			modalities: ['text'],
			supportedParameters: [],
			fetchedAt: toEpochMs(1_792_879_200_000)
		})
		.run();
}

function completed(response: ChatResponseBody | null): ChatResponseBody {
	if (response === null) throw new Error('la respuesta no debía ser nula');
	return response;
}

describe('flujo de chat (§8)', () => {
	it('cobra 776.480 µc con los valores por defecto y devuelve el saldo, sin modelo ni proveedor', async () => {
		const response = completed(await runChat(f.deps, f.context(), chatBody()));

		expect(response).toMatchObject({
			text: 'Respuesta simulada',
			json: null,
			structuredValid: null,
			toolCalls: null,
			truncated: false,
			chargedMicro: CHARGE_MICRO,
			balance: {
				totalMicro: WELCOME_MICRO - CHARGE_MICRO,
				reservedMicro: 0,
				availableMicro: WELCOME_MICRO - CHARGE_MICRO,
				debtMicro: 0
			}
		});
		expect(Object.keys(response)).not.toContain('model');
		expect(Object.keys(response)).not.toContain('provider');
		expect(rowsOf()).toEqual([
			expect.objectContaining({
				id: response.operationId,
				status: 'ok',
				provider: 'openrouter',
				model: 'mistralai/mistral-small',
				chargedMicro: CHARGE_MICRO,
				holdMicro: 12_000_000,
				absorbedMicro: 0,
				costMicroUsd: 400,
				costEstimated: false
			})
		]);
		expect(eventsNamed(f.base.logger, 'ai.operation.started')).toHaveLength(1);
		expect(eventsNamed(f.base.logger, 'ai.operation.completed')).toHaveLength(1);
	});

	it('sin saldo, la fila queda rejected sin reserva y no se llama al proveedor (402)', async () => {
		const poor = chatFixture({ welcome: false });
		try {
			await expect(runChat(poor.deps, poor.context(), chatBody())).rejects.toMatchObject({
				code: 'INSUFFICIENT_BALANCE'
			});
			expect(poor.gateway.chatCalls).toHaveLength(0);
			expect(poor.base.db.select().from(aiOperations).all()).toEqual([
				expect.objectContaining({
					status: 'rejected',
					holdMicro: null,
					errorCode: 'INSUFFICIENT_BALANCE'
				})
			]);
		} finally {
			poor.close();
		}
	});

	it('sin aceptar los documentos legales vigentes, responde TERMS_ACCEPTANCE_REQUIRED sin fila', async () => {
		const unaccepted = chatFixture({ ready: false, welcome: true });
		try {
			await expect(
				runChat(unaccepted.deps, unaccepted.context(), chatBody())
			).rejects.toMatchObject({
				code: 'TERMS_ACCEPTANCE_REQUIRED'
			});
			expect(unaccepted.gateway.chatCalls).toHaveLength(0);
			expect(unaccepted.base.db.select().from(aiOperations).all()).toHaveLength(0);
		} finally {
			unaccepted.close();
		}
	});

	it('una operación desconocida o inactiva responde VALIDATION_ERROR en operation, sin fila', async () => {
		await expect(
			runChat(f.deps, f.context(), chatBody({ operation: 'no_existe' }))
		).rejects.toMatchObject({ code: 'VALIDATION_ERROR', details: { field: 'operation' } });

		f.base.db
			.update(appOperations)
			.set({ active: false })
			.where(eq(appOperations.key, 'improve'))
			.run();
		await expect(runChat(f.deps, f.context(), chatBody())).rejects.toMatchObject({
			code: 'VALIDATION_ERROR',
			details: { field: 'operation' }
		});
		expect(rowsOf()).toHaveLength(0);
		expect(f.gateway.chatCalls).toHaveLength(0);
	});

	it('un coste máximo estimado por encima del tope responde OPERATION_TOO_EXPENSIVE, sin llamar al proveedor', async () => {
		priceModel('mistralai/mistral-small', 2_000_000, 4_000_000);
		priceModel('openai/gpt-5.6-luna', 2_000_000, 4_000_000);
		priceModel('anthropic/claude-haiku-5.5', 1_000_000_000, 1_000_000_000);
		f.setOperationMaxCost(1_000_000);

		await expect(runChat(f.deps, f.context(), chatBody())).rejects.toMatchObject({
			code: 'OPERATION_TOO_EXPENSIVE'
		});
		expect(f.gateway.chatCalls).toHaveLength(0);
		expect(rowsOf()).toEqual([expect.objectContaining({ status: 'rejected', holdMicro: null })]);
	});

	it('si todos los intentos fallan, responde PROVIDER_ERROR sin cobro y libera la reserva', async () => {
		f.gateway.answerNext({ status: 'error', reason: 'http', httpStatus: 500 });
		f.gateway.answerNext({ status: 'error', reason: 'http', httpStatus: 500 });
		f.gateway.answerNext({ status: 'error', reason: 'http', httpStatus: 500 });

		await expect(runChat(f.deps, f.context(), chatBody())).rejects.toMatchObject({
			code: 'PROVIDER_ERROR'
		});

		expect(f.base.credits.getBalance(f.userId)).toMatchObject({
			totalMicro: WELCOME_MICRO,
			reservedMicro: 0
		});
		expect(rowsOf()).toEqual([
			expect.objectContaining({
				status: 'provider_error',
				errorCode: 'PROVIDER_ERROR',
				chargedMicro: 0
			})
		]);
		expect(eventsNamed(f.base.logger, 'ai.provider.retry')).toHaveLength(2);
	});

	it('si el proveedor no responde a tiempo, responde PROVIDER_TIMEOUT (504)', async () => {
		f.gateway.answerNext({ status: 'error', reason: 'timeout', httpStatus: null });
		f.gateway.answerNext({ status: 'error', reason: 'timeout', httpStatus: null });
		f.gateway.answerNext({ status: 'error', reason: 'timeout', httpStatus: null });

		await expect(runChat(f.deps, f.context(), chatBody())).rejects.toMatchObject({
			code: 'PROVIDER_TIMEOUT',
			status: 504
		});
	});

	it('si el principal falla, el respaldo responde y se cobra, con used_fallback', async () => {
		const withoutRetry = chatFixture({ retry: { retries: 0, waitsMs: [0] } });
		try {
			withoutRetry.gateway.answerNext({ status: 'error', reason: 'unavailable', httpStatus: null });
			withoutRetry.gateway.answerNext(FAKE_OK);

			const response = completed(
				await runChat(withoutRetry.deps, withoutRetry.context(), chatBody())
			);

			expect(response.chargedMicro).toBe(CHARGE_MICRO);
			expect(withoutRetry.gateway.chatCalls.map((call) => call.model)).toEqual([
				'anthropic/claude-haiku-5.5',
				'openai/gpt-5.6-luna'
			]);
			expect(withoutRetry.base.db.select().from(aiOperations).all()).toEqual([
				expect.objectContaining({ usedFallback: true, status: 'ok' })
			]);
			expect(eventsNamed(withoutRetry.base.logger, 'ai.provider.fallback')).toHaveLength(1);
		} finally {
			withoutRetry.close();
		}
	});

	it('una respuesta truncada se entrega y se registra el motivo', async () => {
		f.gateway.answerNext({ ...FAKE_OK, truncated: true });

		const response = completed(await runChat(f.deps, f.context(), chatBody()));

		expect(response.truncated).toBe(true);
		expect(eventsNamed(f.base.logger, 'ai.operation.completed')[0]?.fields).toMatchObject({
			reason: 'truncated'
		});
	});

	it('una moderación marca la operación sin contenido ni cobro y responde un error genérico', async () => {
		f.gateway.answerNext({ status: 'flagged' });

		await expect(runChat(f.deps, f.context(), chatBody())).rejects.toMatchObject({
			code: 'PROVIDER_ERROR'
		});

		expect(rowsOf()).toEqual([
			expect.objectContaining({ status: 'provider_error', flagged: true, chargedMicro: 0 })
		]);
		expect(eventsNamed(f.base.logger, 'ai.operation.flagged')).toHaveLength(1);
		expect(f.base.credits.getBalance(f.userId).totalMicro).toBe(WELCOME_MICRO);
	});

	it('sin coste en la respuesta, se pide a /generation y se cobra ese coste', async () => {
		f.gateway.answerNext({ ...FAKE_OK, costMicroUsd: null });
		f.gateway.setGenerationCost(400);

		const response = completed(await runChat(f.deps, f.context(), chatBody()));

		expect(f.gateway.generationCalls).toEqual(['gen-fake-1']);
		expect(response.chargedMicro).toBe(CHARGE_MICRO);
		expect(rowsOf()[0]).toMatchObject({ costEstimated: false, costMicroUsd: 400 });
	});

	it('sin coste y sin /generation, se estima con el precio del modelo y queda marcado como estimado', async () => {
		priceModel('mistralai/mistral-small', 2_000_000, 4_000_000);
		f.gateway.answerNext({ ...FAKE_OK, costMicroUsd: null, inputTokens: 100, outputTokens: 50 });
		f.gateway.setGenerationCost(null);

		const response = completed(await runChat(f.deps, f.context(), chatBody()));

		expect(response.chargedMicro).toBe(CHARGE_MICRO);
		expect(rowsOf()[0]).toMatchObject({ costEstimated: true, costMicroUsd: 400 });
		expect(eventsNamed(f.base.logger, 'ai.cost.estimated')).toHaveLength(1);
	});

	it('con esquema de salida, un JSON válido se devuelve y uno inválido se cobra igual (BE-FR-79)', async () => {
		setCapabilities({ image_input: false, structured_output: true, tools: false });
		const body = {
			...chatBody(),
			response_format: {
				type: 'json_schema' as const,
				json_schema: { name: 'r', schema: { type: 'object' } }
			}
		};

		f.gateway.answerNext({ ...FAKE_OK, text: '{"correcto":true}' });
		const valid = completed(await runChat(f.deps, f.context(), body));
		expect(valid).toMatchObject({ json: { correcto: true }, structuredValid: true });

		f.gateway.answerNext({ ...FAKE_OK, text: 'no es JSON' });
		const invalid = completed(await runChat(f.deps, f.context(), body));
		expect(invalid).toMatchObject({
			json: null,
			structuredValid: false,
			chargedMicro: CHARGE_MICRO
		});
		expect(eventsNamed(f.base.logger, 'ai.provider.invalid_response')).toHaveLength(1);
	});

	it('al arrancar, las operaciones en curso pasan a interrupted sin cobro', () => {
		const operationId = insertInFlightOperation(f.base.db, { userId: f.userId });

		expect(interruptOperationsOnStartup(f.deps)).toBe(1);

		expect(
			f.base.db.select().from(aiOperations).where(eq(aiOperations.id, operationId)).get()
		).toMatchObject({
			status: 'interrupted',
			chargedMicro: 0
		});
		expect(eventsNamed(f.base.logger, 'ai.operation.interrupted')).toEqual([
			expect.objectContaining({ fields: { count: 1 } })
		]);
	});
	it('al llegar al umbral diario de operaciones marcadas, avisa una vez al administrador (FR-061, BE-FR-82)', async () => {
		const admin = insertAdmin(f.base.db);
		updateSetting(f.deps.apps, {
			actorId: admin,
			key: 'flagged_ops_alert_per_day',
			value: 1,
			reason: 'Umbral de la prueba'
		});

		f.gateway.answerNext({ status: 'flagged' });
		await runChat(f.deps, f.context(), chatBody()).catch(() => undefined);
		f.gateway.answerNext({ status: 'flagged' });
		await runChat(f.deps, f.context(), chatBody()).catch(() => undefined);

		expect(eventsNamed(f.base.logger, 'ai.flagged.threshold_reached')).toHaveLength(1);
		expect(f.sender.sent).toHaveLength(1);
	});
});
