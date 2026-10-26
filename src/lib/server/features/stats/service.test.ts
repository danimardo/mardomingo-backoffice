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
		operationKey: 'improve',
		userId: null,
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
		firstOperations: () => [],
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
			{ stage: 'verificadas', count: 0, rate: null },
			{ stage: 'primer_login', count: 0, rate: null },
			{ stage: 'primera_operacion', count: 0, rate: null }
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
					{ date: '2026-10-02', appId: 'app_a', verified: true },
					{ date: '2026-10-03', appId: 'app_a', verified: true },
					{ date: '2026-10-04', appId: null, verified: false }
				],
				firstLogins: () => [{ date: '2026-10-03', appId: 'app_a' }]
			}),
			PERIOD
		);

		expect(stats.totals.signupsByApp.get('app_a')).toBe(2);
		expect(stats.totals.signupsByApp.get('sin_app')).toBe(1);
		expect(stats.totals.firstLoginsByApp.get('app_a')).toBe(1);
		expect(stats.totals.funnel[2]).toEqual({ stage: 'verificadas', count: 2, rate: 2 / 3 });
		expect(stats.totals.funnel[3]).toEqual({ stage: 'primer_login', count: 1, rate: 1 / 2 });
		expect(stats.totals.funnel[4]).toEqual({ stage: 'primera_operacion', count: 0, rate: 0 });
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

describe('agrupación y filtros de operaciones (W45, T320)', () => {
	const fact = (overrides: Record<string, unknown>) => ({
		...op({ costMicroUsd: 1_000_000 }),
		...overrides
	});
	const rows = [
		fact({ appId: 'app_a', operationKey: 'improve', userId: 'usr_1' }),
		fact({ appId: 'app_a', operationKey: 'enhance', userId: 'usr_2' }),
		fact({
			appId: 'app_b',
			operationKey: 'improve',
			userId: null,
			fxRateId: null,
			costMicroUsd: 2_000_000
		})
	];

	it('agrupa por app y suma el coste solo de las operaciones con tipo conocido', () => {
		const stats = statsForPeriod(deps({ operationFacts: () => rows }), PERIOD, { grouping: 'app' });

		expect(stats.groups.map((group) => group.key)).toEqual(['app_a', 'app_b']);
		expect(stats.groups[0]).toMatchObject({ operations: 2, unconverted: 0 });
		expect(stats.groups[1]).toEqual({
			key: 'app_b',
			operations: 1,
			costEurCents: null,
			unconverted: 1
		});
	});

	it('agrupa por operación y por usuario, con «sin_usuario» para las cuentas anonimizadas', () => {
		const operacion = statsForPeriod(deps({ operationFacts: () => rows }), PERIOD, {
			grouping: 'operacion'
		});
		const usuario = statsForPeriod(deps({ operationFacts: () => rows }), PERIOD, {
			grouping: 'usuario'
		});

		expect(operacion.groups.map((group) => group.key)).toEqual(['enhance', 'improve']);
		expect(usuario.groups.map((group) => group.key)).toEqual(['sin_usuario', 'usr_1', 'usr_2']);
	});

	it('un filtro por app deja solo sus operaciones y el margen sin datos', () => {
		const stats = statsForPeriod(deps({ operationFacts: () => rows }), PERIOD, { appId: 'app_a' });

		expect(stats.totals.operationsWithCost).toBe(2);
		expect(stats.totals.marginEurCents).toBeNull();
		expect(stats.days.every((day) => day.marginEurCents === null)).toBe(true);
	});

	it('sin agrupación ni filtro, la serie diaria y el margen se calculan como antes', () => {
		const stats = statsForPeriod(deps({ operationFacts: () => rows }), PERIOD);

		expect(stats.groups).toEqual([]);
		expect(stats.totals.operationsWithCost).toBe(3);
	});
});

describe('embudo por semanas (W45, T320)', () => {
	it('las altas se cuentan por semana y las descargas sin datos son nulas', () => {
		const stats = statsForPeriod(
			deps({
				signups: () => [
					{ date: '2026-10-19', appId: 'app_a', verified: true },
					{ date: '2026-10-21', appId: 'app_a', verified: false }
				]
			}),
			PERIOD,
			{ embudo: 'acumulado' }
		);

		expect(stats.funnelWeeks).toEqual([
			{
				week: '2026-10-19',
				counts: {
					descargas: null,
					altas: 2,
					verificadas: 1,
					primer_login: 0,
					primera_operacion: 0
				}
			}
		]);
	});
});
