// Cancelación por desconexión (BE-FR-37 CA1, FR-059, D-05; T176). Antes de la respuesta del proveedor, la operación queda
// `cancelled` sin cobro y la reserva se libera. El caso «respondió y nadie recibió» (`undelivered`) está en
// `idempotency.int.test.ts`.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { aiOperations } from './schema';
import { runChat } from './service';
import {
	chatBody,
	chatFixture,
	WELCOME_MICRO,
	type ChatFixture
} from '../../../../../tests/builders/chat';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';

let f: ChatFixture;

beforeEach(() => {
	f = chatFixture();
});

afterEach(() => {
	f.close();
});

describe('cancelación antes de la respuesta del proveedor (D-05)', () => {
	it('si el cliente se va mientras el proveedor responde, la operación queda cancelled, sin cobro, y se libera la reserva', async () => {
		f.gateway.holdNext();
		const controller = new AbortController();
		const pending = runChat(f.deps, f.context({ signal: controller.signal }), chatBody());
		expect(f.base.credits.getBalance(f.userId).reservedMicro).toBeGreaterThan(0);

		controller.abort();

		expect(await pending).toBeNull();
		expect(f.base.credits.getBalance(f.userId)).toMatchObject({
			totalMicro: WELCOME_MICRO,
			reservedMicro: 0
		});
		const [row] = f.base.db
			.select()
			.from(aiOperations)
			.where(eq(aiOperations.userId, f.userId))
			.all();
		expect(row).toMatchObject({ status: 'cancelled', chargedMicro: 0, absorbedMicro: 0 });
		expect(eventsNamed(f.base.logger, 'ai.operation.cancelled')).toEqual([
			expect.objectContaining({
				fields: { operationId: row?.id, operation: 'improve', status: 'cancelled' }
			})
		]);
	});
});
