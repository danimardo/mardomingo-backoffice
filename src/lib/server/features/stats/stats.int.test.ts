// Estadísticas de un periodo (BE-FR-54; T318) con datos reales: las compras simuladas no son ingresos, las compras reales sí, el coste
// en euros sale de las operaciones con su tipo de cambio, y «sin datos» nunca es cero. Se usa la base de compras del montaje de pagos.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { paymentsFixture, type PaymentsFixture } from '../../../../../tests/builders/payments';
import { markRealPurchase } from '../../../../../tests/builders/purchases';
import type { PaymentFactRow } from '$lib/server/features/payments';
import type { OperationCostFact, OperationStatsFact } from '$lib/server/features/ai';
import { statsForPeriod, type StatsDeps } from './service';

/** La misma compra, marcada como real: la fixture de pagos siempre usa el proveedor simulado. */
function asReal(fact: PaymentFactRow): PaymentFactRow {
	return { ...fact, simulated: false };
}

function firstFact(facts: readonly PaymentFactRow[]): PaymentFactRow {
	const [fact] = facts;
	if (fact === undefined) throw new Error('la compra de la prueba debía existir');
	return fact;
}

let f: PaymentsFixture;
const RATE = 920_000;

beforeEach(() => {
	f = paymentsFixture('test');
});

afterEach(() => {
	f.close();
});

function period() {
	const now = new Date(f.base.clock.now());
	return {
		fromMs: Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
		toMs: Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)
	};
}

function deps(
	costs: (p: { fromMs: number; toMs: number }) => OperationCostFact[] = () => []
): StatsDeps {
	return {
		paymentFacts: (p) => f.payments.paymentFactsBetween(p),
		operationFacts: (p) => costs(p).map(asOperation),
		forfeits: () => [],
		signups: () => [],
		firstLogins: () => [],
		activeUsers: () => 0,
		usdEurPpmOf: (id) => (id === 'fx_1' ? RATE : null),
		downloads: () => [],
		firstOperations: () => []
	};
}

/** Un coste de IA como operación con estado `ok`, para el formato que lee el servicio de estadísticas. */
function asOperation(cost: OperationCostFact): OperationStatsFact {
	return {
		date: cost.date,
		appId: cost.appId,
		operationKey: 'improve',
		userId: null,
		status: 'ok',
		costMicroUsd: cost.usdMicro,
		chargedMicro: 0,
		absorbedMicro: 0,
		absorbedReason: null,
		usedFallback: false,
		truncated: false,
		fxRateId: cost.fxRateId
	};
}

describe('estadísticas de un periodo (BE-FR-54)', () => {
	it('las compras simuladas no son ingresos: sin compras reales, el ingreso es nulo, no cero', () => {
		const { userId, waiverId } = f.addAccount('usr_stats_sim');
		f.payments.purchase({
			userId,
			role: 'user',
			attemptId: 'att_sim',
			packId: 'pck_seed_10eur',
			wantsFullInvoice: false,
			withdrawalAcceptanceId: waiverId
		});

		const stats = statsForPeriod(deps(), period());

		expect(stats.totals.simulatedPurchases).toBe(1);
		expect(stats.totals.realPurchases).toBe(0);
		expect(stats.totals.revenueEurCents).toBeNull();
		expect(stats.days).toEqual([]);
	});

	it('una compra real cuenta su base sin IVA como ingreso del día', () => {
		const { userId, waiverId } = f.addAccount('usr_stats_real');
		const bought = f.payments.purchase({
			userId,
			role: 'user',
			attemptId: 'att_real',
			packId: 'pck_seed_10eur',
			wantsFullInvoice: false,
			withdrawalAcceptanceId: waiverId
		});
		expect(bought.status).toBe('completed');
		// Las compras del montaje de pagos son simuladas por proveedor: esta se marca real solo para la estadística de ingresos.
		markRealPurchase(f.base.db, userId);
		const fact = firstFact(f.payments.paymentFactsBetween(period()));
		const stats = statsForPeriod({ ...deps(), paymentFacts: () => [asReal(fact)] }, period());

		expect(stats.totals.realPurchases).toBe(1);
		expect(stats.totals.revenueEurCents).toBe(fact.baseEurCents);
	});

	it('el coste sale de las operaciones con su tipo; sin operaciones el coste es nulo y el margen también', () => {
		const withCost = statsForPeriod(
			deps(() => [
				{
					date: '2026-10-16',
					provider: 'openrouter',
					appId: 'app_a',
					usdMicro: 1_000_000,
					fxRateId: 'fx_1'
				},
				{
					date: '2026-10-16',
					provider: 'openrouter',
					appId: 'app_a',
					usdMicro: 1_000_000,
					fxRateId: 'fx_otro'
				}
			]),
			period()
		);
		expect(withCost.totals.operationsWithCost).toBe(2);
		expect(withCost.totals.unconvertedOperations).toBe(1);
		expect(withCost.totals.costEurCents).toBe(92);

		const none = statsForPeriod(deps(), period());
		expect(none.totals.costEurCents).toBeNull();
		expect(none.totals.marginEurCents).toBeNull();
	});

	it('el margen del día es ingresos menos coste cuando hay los dos', () => {
		const { userId, waiverId } = f.addAccount('usr_stats_margen');
		f.payments.purchase({
			userId,
			role: 'user',
			attemptId: 'att_margen',
			packId: 'pck_seed_10eur',
			wantsFullInvoice: false,
			withdrawalAcceptanceId: waiverId
		});
		const fact = firstFact(f.payments.paymentFactsBetween(period()));
		const stats = statsForPeriod(
			{
				...deps(() => [
					{
						date: fact.date,
						provider: 'openrouter',
						appId: 'app_a',
						usdMicro: 1_000_000,
						fxRateId: 'fx_1'
					}
				]),
				paymentFacts: () => [asReal(fact)]
			},
			period()
		);

		expect(stats.days[0]).toMatchObject({
			day: fact.date,
			revenueEurCents: fact.baseEurCents,
			costEurCents: 92,
			marginEurCents: fact.baseEurCents - 92
		});
	});
});
