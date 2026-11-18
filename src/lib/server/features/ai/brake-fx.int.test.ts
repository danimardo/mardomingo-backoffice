// A-03 · El freno global convertía el coste del día con `settings.fx_usd_eur` (0,92 fijo), no con el tipo de cada operación
// (BE-FR-87 CA1: «las operaciones usan el vigente en el momento del cobro»; BE-FR-46: el freno es en euros; C-49, T440).
// Ahora el puerto `dailyCosts` que monta `ai` devuelve céntimos de euro ya convertidos con el `fx_rate_id` de cada operación;
// `protections` solo los suma. La prueba original (A-03) estaba en `protections/` con el arnés de costes en USD micro; tras
// cambiar el puerto, el caso útil es el del adaptador de `ai` con filas reales de `ai_operations`, por eso vive aquí.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fxRates } from '$lib/server/features/pricing/schema';
import { addDays, civilDateOf, madridMidnight } from '$lib/shared/dates';
import { toMicroUsd, toPpm } from '$lib/shared/money';
import { toEpochMs } from '$lib/shared/time';
import { insertInFlightOperation } from '../../../../../tests/builders/ai-operations';
import { chatFixture, type ChatFixture } from '../../../../../tests/builders/chat';
import { guard, requestFor } from '../../../../../tests/builders/protections';
import { aiOperations } from './schema';
import { protectionsOf } from './service';

/** 3 USD: 276 céntimos a 0,92 €/USD (por debajo de los 500 del freno) y 600 céntimos a 2,0 €/USD (por encima). */
const THREE_USD_MICRO = 3_000_000;
const HOUR_MS = 3_600_000;

let f: ChatFixture;
/** Autor de los tipos manuales: solo puede haber un administrador (`one_admin`). */
let adminId: string;

beforeEach(() => {
	f = chatFixture({ userId: 'usr_a03_gratis' });
	adminId = f.base.addUser('adm_a03', 'admin');
});

afterEach(() => {
	f.close();
});

function insertManualRate(id: string, ppm: number, effectiveFrom: number): void {
	f.base.db
		.insert(fxRates)
		.values({
			id,
			usdEurPpm: toPpm(ppm),
			source: 'manual',
			effectiveFrom: toEpochMs(effectiveFrom),
			createdBy: adminId
		})
		.run();
}

/** Una operación completada ahora, de la cuenta gratuita, con su coste en USD micro y el tipo con el que se cobró. */
function completeOperation(costMicroUsd: number, fxRateId: string | null): void {
	const id = insertInFlightOperation(f.base.db, { userId: f.userId });
	f.base.db
		.update(aiOperations)
		.set({
			status: 'ok',
			costMicroUsd: toMicroUsd(costMicroUsd),
			fxRateId,
			completedAt: f.base.clock.now()
		})
		.where(eq(aiOperations.id, id))
		.run();
}

function todayCosts() {
	const today = civilDateOf(f.base.clock.now());
	return protectionsOf(f.deps).dailyCosts.costByUserOfDay(
		madridMidnight(today),
		madridMidnight(addDays(today, 1))
	);
}

describe('A-03 · el freno usa el tipo de cada operación (BE-FR-87 CA1, BE-FR-46; C-49)', () => {
	it('3 USD cobrados a 2,0 €/USD son 600 céntimos y activan el freno de 5 €, aunque el vigente ahora sea 0,92', async () => {
		const now = f.base.clock.now();
		insertManualRate('fx_a03_dos', 2_000_000, now - 2 * HOUR_MS);
		insertManualRate('fx_a03_vigente', 920_000, now - HOUR_MS);
		completeOperation(THREE_USD_MICRO, 'fx_a03_dos');

		expect(todayCosts()).toEqual([{ userId: f.userId, costEurCents: 600 }]);
		await expect(guard(protectionsOf(f.deps), requestFor(f.userId))).rejects.toMatchObject({
			code: 'SERVICE_LIMITED'
		});
	});

	it('una operación sin tipo guardado se convierte con el vigente ahora (2,0 €/USD): el freno no se queda corto', () => {
		insertManualRate('fx_a03_solo', 2_000_000, f.base.clock.now() - HOUR_MS);
		completeOperation(THREE_USD_MICRO, null);

		expect(todayCosts()).toEqual([{ userId: f.userId, costEurCents: 600 }]);
	});

	it('suma por cuenta los grupos de tipos distintos, cada uno redondeado hacia arriba', () => {
		const now = f.base.clock.now();
		insertManualRate('fx_a03_dos', 2_000_000, now - 2 * HOUR_MS);
		insertManualRate('fx_a03_vigente', 920_000, now - HOUR_MS);
		completeOperation(1_000_000, 'fx_a03_dos');
		completeOperation(1_000_000, 'fx_a03_vigente');

		expect(todayCosts()).toEqual([{ userId: f.userId, costEurCents: 200 + 92 }]);
	});

	it('control: sin filas en fx_rates se usa 0,92 y 3 USD (276 céntimos) no activan el freno', async () => {
		completeOperation(THREE_USD_MICRO, null);

		expect(todayCosts()).toEqual([{ userId: f.userId, costEurCents: 276 }]);
		await expect(guard(protectionsOf(f.deps), requestFor(f.userId))).resolves.toBeTypeOf(
			'function'
		);
	});
});
