// Servicio de estadísticas (BE-FR-54; T318): cancelaciones, pérdidas absorbidas, respaldos, truncadas, saldo anulado, altas, primeros
// inicios y embudo. Dependencias simuladas: la regla es la misma que en el servicio real y no hay base de datos.
import { describe, expect, it } from 'vitest';
import { statsForPeriod, type StatsDeps } from './service';

const PERIOD = { fromMs: Date.UTC(2026, 9, 1), toMs: Date.UTC(2026, 9, 31, 23, 59, 59) };

function op(
	overrides: Partial<Parameters<StatsDeps['operationFacts']>[0]> & Record<string, unknown> = {}
) {
	return {
		date: '2026-10-16',
		appId: 'app_a',
		status: 'ok',
		costMicroUsd: 0,
		chargedMicro: 0,
		absorbedMicro: 0,
		absorbedReason: null,
		usedFallback: false,
		truncated: false,
		fxRateId: 'fx_1',
		...overrides
	};
}

function deps(overrides: Partial<StatsDeps> = {}): StatsDeps {
	return {
		paymentFacts: () => [],
		operationFacts: () => [],
		forfeits: () => [],
		signups: () => [],
		firstLogins: () => [],
		activeUsers: () => 0,
		usdEurPpmOf: (id) => (id === 'fx_1' ? 920_000 : null),
		downloads: () => [],
		...overrides
	};
}

describe('servicio de estadísticas (BE-FR-54)', () => {
	it('sin datos, cada métrica es nula o cero según sea un total o un recuento, nunca inventada', () => {
		const stats = statsForPeriod(deps(), PERIOD);

		expect(stats.totals.revenueEurCents).toBeNull();
		expect(stats.totals.costEurCents).toBeNull();
		expect(stats.totals.marginEurCents).toBeNull();
		expect(stats.totals.cancellationCostEurCents).toBeNull();
		expect(stats.totals.forfeitedMicro).toBe(0);
		expect(stats.totals.activeUsers).toBe(0);
		expect(stats.totals.funnel).toEqual([
			{ stage: 'descargas', count: null, rate: null },
			{ stage: 'altas', count: 0, rate: null },
			{ stage: 'primer_login', count: 0, rate: null }
		]);
		expect(stats.totals.downloads).toBeNull();
	});

	it('el coste de las cancelaciones sin cobro se suma aparte, en euros', () => {
		const stats = statsForPeriod(
			deps({
				operationFacts: () => [
					op({ status: 'cancelled', costMicroUsd: 1_000_000, chargedMicro: 0 }),
					op({ status: 'ok', costMicroUsd: 1_000_000, chargedMicro: 1_000_000 })
				]
			}),
			PERIOD
		);

		expect(stats.totals.cancellationCostEurCents).toBe(92);
		expect(stats.totals.costEurCents).toBe(184);
		expect(stats.totals.operationsByStatus.get('cancelled')).toBe(1);
	});

	it('las pérdidas por deuda y por repeticiones no cobradas van por separado, en micro-créditos', () => {
		const stats = statsForPeriod(
			deps({
				operationFacts: () => [
					op({ absorbedMicro: 300_000, absorbedReason: 'debt_cap' }),
					op({ absorbedMicro: 200_000, absorbedReason: 'undelivered_replay' }),
					op({ absorbedMicro: 100_000, absorbedReason: 'undelivered_replay' })
				]
			}),
			PERIOD
		);

		expect(stats.totals.absorbedDebtMicro).toBe(300_000);
		expect(stats.totals.absorbedReplayMicro).toBe(300_000);
	});

	it('cuenta respaldos y truncadas, y no las confunde con las demás', () => {
		const stats = statsForPeriod(
			deps({
				operationFacts: () => [
					op({ usedFallback: true }),
					op({ truncated: true, status: 'interrupted' }),
					op({ status: 'provider_error' })
				]
			}),
			PERIOD
		);

		expect(stats.totals.fallbackOperations).toBe(1);
		expect(stats.totals.truncatedOperations).toBe(1);
		expect(stats.totals.operationsByStatus.get('provider_error')).toBe(1);
	});

	it('el saldo anulado por borrado suma los movimientos forfeit del periodo', () => {
		const stats = statsForPeriod(
			deps({
				forfeits: () => [
					{ date: '2026-10-05', micro: 400_000 },
					{ date: '2026-10-09', micro: 600_000 }
				]
			}),
			PERIOD
		);

		expect(stats.totals.forfeitedMicro).toBe(1_000_000);
	});

	it('altas y primeros inicios se agrupan por app; sin app de origen, aparece como sin_app', () => {
		const stats = statsForPeriod(
			deps({
				signups: () => [
					{ date: '2026-10-02', appId: 'app_a' },
					{ date: '2026-10-03', appId: 'app_a' },
					{ date: '2026-10-04', appId: null }
				],
				firstLogins: () => [{ date: '2026-10-03', appId: 'app_a' }]
			}),
			PERIOD
		);

		expect(stats.totals.signupsByApp.get('app_a')).toBe(2);
		expect(stats.totals.signupsByApp.get('sin_app')).toBe(1);
		expect(stats.totals.firstLoginsByApp.get('app_a')).toBe(1);
		expect(stats.totals.funnel[2]).toEqual({ stage: 'primer_login', count: 1, rate: 1 / 3 });
	});

	it('el coste de una operación sin tipo conocido no suma euros y se cuenta aparte', () => {
		const stats = statsForPeriod(
			deps({ operationFacts: () => [op({ costMicroUsd: 1_000_000, fxRateId: null })] }),
			PERIOD
		);

		expect(stats.totals.unconvertedOperations).toBe(1);
		expect(stats.totals.costEurCents).toBe(0);
	});
});
