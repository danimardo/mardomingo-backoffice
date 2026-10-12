// Concurrencia de reservas en `/ai/chat` (BE-FR-71, FR-029; T175). Las reservas se hacen dentro de transacciones
// `BEGIN IMMEDIATE`, así que varias peticiones simultáneas no reservan más saldo del que hay: las que no caben se rechazan
// sin llamar al proveedor.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { userBalances } from '$lib/server/features/credits/schema';
import { FAKE_OK } from '$lib/server/adapters/openrouter/fake';
import { aiOperations } from './schema';
import { runChat } from './service';
import {
	chatBody,
	chatFixture,
	WELCOME_MICRO,
	type ChatFixture
} from '../../../../../tests/builders/chat';
import { appOperations } from '$lib/server/features/apps/schema';
import { eq, and } from 'drizzle-orm';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { toMicro } from '$lib/shared/money';

const CHARGE_MICRO = 776_480;
/**
 * Tope de 500 créditos por reserva. La capacidad es el saldo (1.000) más la deuda permitida (`max_debt`, 200): caben dos
 * reservas (1.000) y la tercera (1.500) no.
 */
const MAX_COST_MICRO = 500_000_000;

let f: ChatFixture;

beforeEach(() => {
	f = chatFixture();
	f.base.db
		.update(appOperations)
		.set({ maxCostMicro: toMicro(MAX_COST_MICRO) })
		.where(and(eq(appOperations.appId, SEEDED_APP_ID), eq(appOperations.key, 'improve')))
		.run();
});

afterEach(() => {
	f.close();
});

describe('concurrencia de reservas (BE-FR-71)', () => {
	it('con saldo para dos reservas, de cinco peticiones simultáneas solo dos llegan al proveedor', async () => {
		// Cada reserva ocupa 500 créditos, más que el tope diario de una cuenta sin compra real. Esta prueba mide el saldo bajo
		// concurrencia: la cuenta tiene compra real y queda exenta del tope (el tope tiene sus propias pruebas en credits).
		f.base.db
			.update(userBalances)
			.set({ hasRealPurchase: true })
			.where(eq(userBalances.userId, f.userId))
			.run();
		f.gateway.holdNext();
		f.gateway.holdNext();

		const [first, second, ...rest] = [1, 2, 3, 4, 5].map(() =>
			runChat(f.deps, f.context(), chatBody())
		);
		// Las tres que no caben fallan al reservar, sin esperar a las dos retenidas.
		const rejected = await Promise.allSettled(rest);

		expect(f.gateway.chatCalls).toHaveLength(2);
		expect(rejected.map((item) => item.status)).toEqual(['rejected', 'rejected', 'rejected']);
		for (const item of rejected) {
			expect(item.status === 'rejected' ? item.reason : undefined).toMatchObject({
				code: 'INSUFFICIENT_BALANCE'
			});
		}

		f.gateway.held[0]?.resolve(FAKE_OK);
		f.gateway.held[1]?.resolve(FAKE_OK);
		await Promise.all([first, second]);

		expect(f.base.credits.getBalance(f.userId)).toMatchObject({
			totalMicro: WELCOME_MICRO - 2 * CHARGE_MICRO,
			reservedMicro: 0
		});
		const rows = f.base.db.select().from(aiOperations).all();
		expect(rows.filter((row) => row.status === 'ok')).toHaveLength(2);
		expect(rows.filter((row) => row.status === 'rejected')).toHaveLength(3);
	});
});
