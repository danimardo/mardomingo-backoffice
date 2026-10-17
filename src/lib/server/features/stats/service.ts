// Estadísticas de un periodo (BE-FR-54; T319). Compone lecturas públicas de `payments` (compras) y de `ai` (coste de IA), convertido a
// euros con el tipo de cada operación (`pricing`). No lee tablas ajenas. Reglas:
// - Ingresos: base sin IVA de las compras completadas que son reales. Las simuladas no son ingresos (BE-FR-25 CA3).
// - Coste: suma de las operaciones con coste en el periodo, en euros. Si no hay ninguna operación con coste, el coste es nulo, no cero.
// - Margen: ingresos menos coste (nulo si falta cualquiera de los dos).
// Pendiente (anotado en tasks.md): reembolsos netos, pérdidas por deuda y por repeticiones, saldo perdido por borrado y embudo de altas.
import type { OperationCostFact } from '$lib/server/features/ai';
import type { PaymentFactRow } from '$lib/server/features/payments';
import { grossMargin, groupSum, usdMicroToEurCents } from './domain/metrics';

export interface StatsDeps {
	readonly paymentFacts: (period: {
		readonly fromMs: number;
		readonly toMs: number;
	}) => readonly PaymentFactRow[];
	readonly costFacts: (period: {
		readonly fromMs: number;
		readonly toMs: number;
	}) => readonly OperationCostFact[];
	readonly usdEurPpmOf: (fxRateId: string) => number | null;
}

export interface DayStats {
	readonly day: string;
	readonly revenueEurCents: number | null;
	readonly costEurCents: number | null;
	readonly marginEurCents: number | null;
}

export interface PeriodStats {
	readonly days: readonly DayStats[];
	readonly totals: {
		readonly revenueEurCents: number | null;
		readonly costEurCents: number | null;
		readonly marginEurCents: number | null;
		readonly realPurchases: number;
		readonly simulatedPurchases: number;
		readonly operationsWithCost: number;
		readonly unconvertedOperations: number;
	};
}

export function statsForPeriod(
	deps: StatsDeps,
	period: { readonly fromMs: number; readonly toMs: number }
): PeriodStats {
	const purchases = deps.paymentFacts(period).filter((fact) => !fact.simulated);
	const simulated = deps.paymentFacts(period).filter((fact) => fact.simulated);
	const costs = deps.costFacts(period);

	// Coste por día en euros; las operaciones sin tipo conocido no suman euros y se cuentan aparte.
	let unconverted = 0;
	const costRows: { day: string; cents: number }[] = [];
	for (const fact of costs) {
		const ppm = fact.fxRateId === null ? null : deps.usdEurPpmOf(fact.fxRateId);
		if (ppm === null) unconverted += 1;
		costRows.push({
			day: fact.date,
			cents: ppm === null ? 0 : usdMicroToEurCents(fact.usdMicro, ppm)
		});
	}
	const revenueByDay = groupSum(
		purchases,
		(fact) => fact.date,
		(fact) => fact.baseEurCents
	);
	const costByDay = groupSum(
		costRows,
		(row) => row.day,
		(row) => row.cents
	);

	const days = [...new Set([...revenueByDay.keys(), ...costByDay.keys()])].sort().map((day) => {
		const revenue = revenueByDay.get(day) ?? null;
		const cost = costByDay.get(day) ?? null;
		return {
			day,
			revenueEurCents: revenue,
			costEurCents: cost,
			marginEurCents: grossMargin(revenue, cost)
		};
	});

	const revenueTotal =
		purchases.length === 0 ? null : purchases.reduce((sum, fact) => sum + fact.baseEurCents, 0);
	const costTotal =
		costRows.length === 0 ? null : costRows.reduce((sum, row) => sum + row.cents, 0);
	return {
		days,
		totals: {
			revenueEurCents: revenueTotal,
			costEurCents: costTotal,
			marginEurCents: grossMargin(revenueTotal, costTotal),
			realPurchases: purchases.length,
			simulatedPurchases: simulated.length,
			operationsWithCost: costs.length,
			unconvertedOperations: unconverted
		}
	};
}
