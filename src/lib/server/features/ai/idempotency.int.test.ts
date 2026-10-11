// Idempotencia de `/ai/chat` contra SQLite real y el doble de OpenRouter (BE-FR-81 CA1–CA2, D-12; T164). Una clave en curso
// responde `REQUEST_IN_PROGRESS`; una entregada, `DUPLICATE_REQUEST`; una no entregada se repite sin cobro, y fuera de la
// ventana la petición es independiente.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FAKE_OK } from '$lib/server/adapters/openrouter/fake';
import { aiOperations } from './schema';
import { runChat } from './service';
import { chatBody, chatFixture, type ChatFixture } from '../../../../../tests/builders/chat';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';

const KEY = '3f2b8c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
const WINDOW_MS = 10 * 60 * 1000;
/** Coste de 0,0004 USD con los valores por defecto (api-v1 7.3: 776.480 µc). */
const CHARGE_MICRO = 776_480;

let f: ChatFixture;

beforeEach(() => {
	f = chatFixture();
});

afterEach(() => {
	f.close();
});

function rowOf(id: string) {
	return f.base.db.select().from(aiOperations).where(eq(aiOperations.id, id)).get();
}

describe('idempotencia de /ai/chat (BE-FR-81)', () => {
	it('una clave con una operación en curso responde REQUEST_IN_PROGRESS sin llamar al proveedor', async () => {
		f.gateway.holdNext();
		const first = runChat(f.deps, f.context({ idempotencyKey: KEY }), chatBody());

		await expect(
			runChat(f.deps, f.context({ idempotencyKey: KEY }), chatBody())
		).rejects.toMatchObject({
			code: 'REQUEST_IN_PROGRESS'
		});
		expect(f.gateway.chatCalls).toHaveLength(1);

		f.gateway.held[0]?.resolve(FAKE_OK);
		expect(await first).not.toBeNull();
	});

	it('repetir una clave ya entregada responde DUPLICATE_REQUEST con su operationId, sin ejecutar', async () => {
		const first = await runChat(f.deps, f.context({ idempotencyKey: KEY }), chatBody());

		await expect(
			runChat(f.deps, f.context({ idempotencyKey: KEY }), chatBody())
		).rejects.toMatchObject({
			code: 'DUPLICATE_REQUEST',
			details: { operationId: first?.operationId }
		});
		expect(f.gateway.chatCalls).toHaveLength(1);
	});

	it('tras una operación no entregada se ejecuta de nuevo sin cobro, y el coste queda absorbido', async () => {
		const controller = new AbortController();
		f.gateway.afterNextAnswer(() => {
			controller.abort();
		});
		const first = await runChat(
			f.deps,
			f.context({ idempotencyKey: KEY, signal: controller.signal }),
			chatBody()
		);
		expect(first).toBeNull();
		const afterFirst = f.base.credits.getBalance(f.userId).totalMicro;
		expect(afterFirst).toBe(1_000_000_000 - CHARGE_MICRO);

		const second = await runChat(f.deps, f.context({ idempotencyKey: KEY }), chatBody());

		expect(second?.chargedMicro).toBe(0);
		expect(f.base.credits.getBalance(f.userId).totalMicro).toBe(afterFirst);
		const row = second === null ? undefined : rowOf(second.operationId);
		expect(row).toMatchObject({
			status: 'ok',
			chargedMicro: 0,
			absorbedMicro: CHARGE_MICRO,
			absorbedReason: 'undelivered_replay'
		});
		expect(eventsNamed(f.base.logger, 'ai.idempotency.replayed')).toHaveLength(1);
	});

	it('pasada la ventana, la misma clave es una petición independiente', async () => {
		await runChat(f.deps, f.context({ idempotencyKey: KEY }), chatBody());
		f.base.clock.advance(WINDOW_MS + 1_000);

		const again = await runChat(f.deps, f.context({ idempotencyKey: KEY }), chatBody());

		expect(again).not.toBeNull();
		expect(f.gateway.chatCalls).toHaveLength(2);
	});

	it('sin cabecera de idempotencia, cada petición es independiente', async () => {
		await runChat(f.deps, f.context(), chatBody());
		await runChat(f.deps, f.context(), chatBody());

		expect(f.gateway.chatCalls).toHaveLength(2);
	});
});
