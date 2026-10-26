// Protecciones en el servicio de `ai` contra la base real (BE-FR-43, BE-FR-46; T202–T203): la petición 31 del mismo minuto
// se rechaza antes de llegar al proveedor, y el coste real del día que alimenta el freno sale de la tabla de operaciones
// en el día de Madrid de la cuenta.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { updateSetting } from '$lib/server/features/apps';
import { userBalances } from '$lib/server/features/credits/schema';
import { addDays, civilDateOf, madridMidnight } from '$lib/shared/dates';
import { toMicroUsd } from '$lib/shared/money';
import { insertInFlightOperation } from '../../../../../tests/builders/ai-operations';
import { addSecondApp, appsTestContext } from '../../../../../tests/builders/apps';
import { chatBody, chatFixture, type ChatFixture } from '../../../../../tests/builders/chat';
import { insertCompletedPurchase } from '../../../../../tests/builders/purchases';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { aiOperations } from './schema';
import { realCostByUserOfDay } from './repository';
import { runChat } from './service';

let f: ChatFixture;

beforeEach(() => {
	f = chatFixture();
});

afterEach(() => {
	f.close();
});

describe('frecuencia por minuto en el chat (BE-FR-43)', () => {
	it('la petición 31 del mismo minuto responde RATE_LIMITED con Retry-After y no llega al proveedor', async () => {
		for (let i = 0; i < 30; i += 1) {
			await runChat(f.deps, f.context(), chatBody());
		}

		await expect(runChat(f.deps, f.context(), chatBody())).rejects.toMatchObject({
			code: 'RATE_LIMITED',
			details: { retryAfterSeconds: 60 }
		});
		expect(f.gateway.chatCalls).toHaveLength(30);
	});
});

describe('coste real diario del freno (BE-FR-46)', () => {
	it('suma el coste de la cuenta en su día de Madrid y no lo cuenta en otro día', async () => {
		await runChat(f.deps, f.context(), chatBody());
		const today = civilDateOf(f.base.clock.now());

		const sameDay = realCostByUserOfDay(
			f.base.db,
			madridMidnight(today),
			madridMidnight(addDays(today, 1))
		);
		const otherDay = realCostByUserOfDay(
			f.base.db,
			madridMidnight(addDays(today, -1)),
			madridMidnight(today)
		);

		expect(sameDay).toHaveLength(1);
		expect(sameDay[0]?.userId).toBe(f.userId);
		expect(sameDay[0]?.costMicroUsd).toBeGreaterThan(0);
		expect(otherDay).toEqual([]);
	});
});

describe('tope diario de cuentas sin compra real en el chat (FR-022, BE-FR-11.6)', () => {
	/** Cambia el tope por la vía del administrador: valida, audita e invalida la caché de ajustes. */
	function setDailyCap(value: number): void {
		const adminId = f.base.addUser('adm_tope', 'admin');
		updateSetting(f.deps.apps, {
			actorId: adminId,
			key: 'daily_cap_no_purchase',
			value,
			reason: 'prueba del tope diario'
		});
	}

	it('con el tope diario agotado, el chat responde 402 DAILY_FREE_LIMIT_REACHED y no llega al proveedor', async () => {
		setDailyCap(1);

		await expect(runChat(f.deps, f.context(), chatBody())).rejects.toMatchObject({
			code: 'DAILY_FREE_LIMIT_REACHED',
			status: 402
		});
		expect(f.gateway.chatCalls).toHaveLength(0);
		expect(f.base.credits.getBalance(f.userId).reservedMicro).toBe(0);
	});

	it('una cuenta con compra real no tiene tope diario', async () => {
		setDailyCap(1);
		f.base.db
			.update(userBalances)
			.set({ hasRealPurchase: true })
			.where(eq(userBalances.userId, f.userId))
			.run();

		await expect(runChat(f.deps, f.context(), chatBody())).resolves.not.toBeNull();
	});

	it('[BE-FR-11/CA2] una compra simulada no quita el tope diario de la cuenta', async () => {
		setDailyCap(1);
		insertCompletedPurchase(f.base.db, {
			paymentId: 'pay_simulada_tope',
			userId: f.userId,
			creditsMicro: 1_000_000,
			simulated: true,
			now: f.base.clock.now()
		});
		f.base.credits.grantPurchase({
			userId: f.userId,
			paymentId: 'pay_simulada_tope',
			amountMicro: 1_000_000,
			simulated: true
		});

		await expect(runChat(f.deps, f.context(), chatBody())).rejects.toMatchObject({
			code: 'DAILY_FREE_LIMIT_REACHED'
		});
	});
});

describe('tope diario sumado entre apps (BE-FR-63/CA4)', () => {
	it('[BE-FR-63/CA4] el coste del día de una cuenta suma sus operaciones de todas las apps', () => {
		const secondAppId = addSecondApp(appsTestContext(f.base.db));
		const now = f.base.clock.now();
		for (const appId of [SEEDED_APP_ID, secondAppId]) {
			const id = insertInFlightOperation(f.base.db, { userId: f.userId, appId });
			f.base.db
				.update(aiOperations)
				.set({ status: 'ok', costMicroUsd: toMicroUsd(250_000), completedAt: now })
				.where(eq(aiOperations.id, id))
				.run();
		}
		const today = civilDateOf(now);

		const costs = realCostByUserOfDay(
			f.base.db,
			madridMidnight(today),
			madridMidnight(addDays(today, 1))
		);

		expect(costs).toEqual([{ userId: f.userId, costMicroUsd: 500_000 }]);
	});
});
