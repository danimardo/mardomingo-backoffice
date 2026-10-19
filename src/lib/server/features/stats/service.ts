// Estadísticas de un periodo (BE-FR-54; T318–T319). Compone lecturas públicas de `payments`, `ai`, `credits`, `accounts` y `pricing`;
// no lee tablas ajenas. Reglas:
// - Ingresos: base sin IVA de las compras completadas que son reales. Las simuladas no son ingresos (BE-FR-25 CA3).
// - Coste de IA: operaciones con coste, en euros con el tipo de cada una. Sin operaciones con coste, el coste es nulo, no cero.
// - Coste de cancelación: lo que costó el proveedor en operaciones canceladas sin cobro (D-05).
// - Margen: ingresos menos coste (nulo si falta cualquiera de los dos).
// - Pérdidas: lo absorbido por deuda (`debt_cap`) y por repeticiones no cobradas (`undelivered_replay`), en micro-créditos.
// - Embudo: altas y primer inicio de sesión. Las descargas (`release_downloads`) las escribe la tarea diaria de L14: hasta entonces, nulas.
import type { OperationStatsFact } from '$lib/server/features/ai';
import type { FirstLoginFact, SignupFact } from '$lib/server/features/accounts';
import type { ForfeitFact } from '$lib/server/features/credits';
import type { PaymentFactRow } from '$lib/server/features/payments';
import type { DownloadFact } from './downloads-read';
import {
	funnel,
	grossMargin,
	groupSum,
	usdMicroToEurCents,
	type FunnelStage
} from './domain/metrics';

export interface StatsPeriod {
	readonly fromMs: number;
	readonly toMs: number;
}

export interface StatsDeps {
	readonly paymentFacts: (period: StatsPeriod) => readonly PaymentFactRow[];
	readonly operationFacts: (period: StatsPeriod) => readonly OperationStatsFact[];
	readonly forfeits: (period: StatsPeriod) => readonly ForfeitFact[];
	readonly signups: (period: StatsPeriod) => readonly SignupFact[];
	readonly firstLogins: (period: StatsPeriod) => readonly FirstLoginFact[];
	readonly activeUsers: (period: StatsPeriod) => number;
	readonly usdEurPpmOf: (fxRateId: string) => number | null;
	readonly downloads: (period: StatsPeriod) => readonly DownloadFact[];
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
		readonly cancellationCostEurCents: number | null;
		readonly realPurchases: number;
		readonly simulatedPurchases: number;
		readonly operationsWithCost: number;
		readonly unconvertedOperations: number;
		readonly operationsByStatus: ReadonlyMap<string, number>;
		readonly truncatedOperations: number;
		readonly fallbackOperations: number;
		readonly absorbedDebtMicro: number;
		readonly absorbedReplayMicro: number;
		readonly forfeitedMicro: number;
		readonly activeUsers: number;
		readonly signupsByApp: ReadonlyMap<string, number>;
		readonly firstLoginsByApp: ReadonlyMap<string, number>;
		readonly funnel: readonly FunnelStage[];
		/** Descargas de los releases del periodo; nulo si la tarea diaria no tiene datos (no es cero). */
		readonly downloads: number | null;
	};
}

const SIN_APP = 'sin_app';

export function statsForPeriod(deps: StatsDeps, period: StatsPeriod): PeriodStats {
	const payments = deps.paymentFacts(period);
	const purchases = payments.filter((fact) => !fact.simulated);
	const simulated = payments.filter((fact) => fact.simulated);
	const operations = deps.operationFacts(period);

	// Coste de IA en euros por día; las operaciones sin tipo conocido no suman euros y se cuentan aparte.
	let unconverted = 0;
	const costRows: { day: string; cents: number; cancelled: boolean }[] = [];
	for (const operation of operations) {
		if (operation.costMicroUsd <= 0) continue;
		const ppm = operation.fxRateId === null ? null : deps.usdEurPpmOf(operation.fxRateId);
		if (ppm === null) unconverted += 1;
		costRows.push({
			day: operation.date,
			cents: ppm === null ? 0 : usdMicroToEurCents(operation.costMicroUsd, ppm),
			cancelled: operation.status === 'cancelled' && operation.chargedMicro === 0
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
	const cancelled = costRows.filter((row) => row.cancelled);
	const cancellationTotal =
		cancelled.length === 0 ? null : cancelled.reduce((sum, row) => sum + row.cents, 0);

	const operationsByStatus = groupSum(
		operations,
		(operation) => operation.status,
		() => 1
	);
	const absorbedByReason = groupSum(
		operations.filter((operation) => operation.absorbedReason !== null),
		(operation) => operation.absorbedReason ?? SIN_APP,
		(operation) => operation.absorbedMicro
	);

	const signupsList = deps.signups(period);
	const firstLogins = deps.firstLogins(period);
	const signupsByApp = groupSum(
		signupsList,
		(row) => row.appId ?? SIN_APP,
		() => 1
	);
	const firstLoginsByApp = groupSum(
		firstLogins,
		(row) => row.appId,
		() => 1
	);
	const downloadRows = deps.downloads(period);
	const downloadTotal =
		downloadRows.length === 0 ? null : downloadRows.reduce((sum, row) => sum + row.downloads, 0);
	const stages = funnel([
		{ stage: 'descargas', count: downloadTotal },
		{ stage: 'altas', count: signupsList.length },
		{ stage: 'primer_login', count: firstLogins.length }
	]);

	return {
		days,
		totals: {
			revenueEurCents: revenueTotal,
			costEurCents: costTotal,
			marginEurCents: grossMargin(revenueTotal, costTotal),
			cancellationCostEurCents: cancellationTotal,
			realPurchases: purchases.length,
			simulatedPurchases: simulated.length,
			operationsWithCost: costRows.length,
			unconvertedOperations: unconverted,
			operationsByStatus,
			truncatedOperations: operations.filter((operation) => operation.truncated).length,
			fallbackOperations: operations.filter((operation) => operation.usedFallback).length,
			absorbedDebtMicro: absorbedByReason.get('debt_cap') ?? 0,
			absorbedReplayMicro: absorbedByReason.get('undelivered_replay') ?? 0,
			forfeitedMicro: deps.forfeits(period).reduce((sum, row) => sum + row.micro, 0),
			activeUsers: deps.activeUsers(period),
			signupsByApp,
			firstLoginsByApp,
			funnel: stages,
			downloads: downloadTotal
		}
	};
}
