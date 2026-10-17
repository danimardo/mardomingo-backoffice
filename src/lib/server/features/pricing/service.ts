// Servicio de `pricing` (BE-FR-19, BE-FR-72, BE-FR-87; T152). Tipo de cambio vigente, actualización desde el BCE con
// alerta por falta de actualización, valor manual auditado y el cobro en créditos. Las transacciones son `BEGIN IMMEDIATE`
// y no abren ninguna `await`: el BCE se consulta fuera de ellas.
import type { Clock } from '$lib/server/adapters/clock/clock';
import type { FxSource } from '$lib/server/adapters/ecb/fx-source';
import type { Db } from '$lib/server/db/client';
import { immediateTransaction } from '$lib/server/db/tx';
import { getEffectiveConfig, getSetting, type AppsDeps } from '$lib/server/features/apps';
import { recordEntry, type AuditDeps } from '$lib/server/features/audit';
import {
	alertKeys,
	clearAlert,
	raiseAlert,
	type AlertDeps
} from '$lib/server/features/notifications';
import type { Logger } from '$lib/server/logging/logger';
import type { IdGenerator } from '$lib/server/shared/ids';
import { AppError } from '$lib/server/shared/errors';
import { computeCharge, marginFor } from './domain/charge';
import {
	currentFx,
	currentRowOf,
	fxUsdEurPpm,
	isCurrentEcbObservation,
	parseRatePpm,
	staleWeekdays,
	type CurrentFx
} from './domain/fx';
import {
	fxRowsInForce,
	insertFxRecord,
	lastEcbRecord,
	manualPriceOf,
	upsertPriceReference,
	usdEurPpmOfRate
} from './repository';

export interface PricingDeps {
	readonly db: Db;
	readonly logger: Logger;
	readonly clock: Clock;
	readonly ids: IdGenerator;
	readonly apps: AppsDeps;
	readonly audit: AuditDeps;
	readonly alerts: AlertDeps;
	readonly fxSource: FxSource;
}

export type Provider = 'openrouter' | 'mistral';

export type RefreshOutcome =
	| { readonly status: 'updated'; readonly usdEurPpm: number }
	| { readonly status: 'no_publication' }
	| {
			readonly status: 'failed';
			readonly reason: 'unavailable' | 'invalid' | 'http' | 'stale_observation';
	  };

function numberSetting(deps: PricingDeps, key: Parameters<typeof getSetting>[1]): number {
	const value = getSetting(deps.apps, key);
	if (typeof value !== 'number')
		throw new AppError('INTERNAL_ERROR', { reason: 'settings_missing' });
	return value;
}

/** Tipo vigente en el instante de la consulta, con el id de su fila para guardarlo en la operación (`fx_rate_id`). */
export function getCurrentFxRate(
	deps: PricingDeps
): CurrentFx & { readonly fxRateId: string | null } {
	const now = deps.clock.now();
	const rows = fxRowsInForce(deps.db, now);
	const row = currentRowOf(rows, now);
	return { ...currentFx(rows, now), fxRateId: row?.id ?? null };
}

/** Alerta `fx_stale` si la última publicación del BCE está atrasada `fx_stale_alert_days` días laborables. */
async function alertIfStale(deps: PricingDeps): Promise<void> {
	const last = lastEcbRecord(deps.db);
	if (last === undefined || last.ecbDate === null) return;
	const days = staleWeekdays(last.ecbDate, String(deps.clock.today()));
	if (days >= numberSetting(deps, 'fx_stale_alert_days')) {
		await raiseAlert(deps.alerts, { key: alertKeys.fxStale(), detail: String(days) });
	}
}

/**
 * Consulta el BCE y guarda el tipo de cambio (BE-FR-87 CA1). Si no hay publicación (fin de semana), no cambia nada. Si
 * falla o la observación está atrasada, mantiene el último valor y avisa al administrador tras `fx_stale_alert_days`.
 */
export async function refreshFxFromEcb(deps: PricingDeps): Promise<RefreshOutcome> {
	const fetched = await deps.fxSource.fetchLatest();
	if (fetched.status === 'empty') return { status: 'no_publication' };

	const fail = async (
		reason: 'unavailable' | 'invalid' | 'http' | 'stale_observation'
	): Promise<RefreshOutcome> => {
		deps.logger.emit('pricing.fx.refresh_failed', { reason });
		await alertIfStale(deps);
		return { status: 'failed', reason };
	};
	if (fetched.status === 'error') return fail(fetched.reason);

	const today = String(deps.clock.today());
	if (!isCurrentEcbObservation({ timePeriod: fetched.timePeriod, today }))
		return fail('stale_observation');

	let bceRatePpm: number;
	try {
		bceRatePpm = parseRatePpm(fetched.rate);
	} catch {
		return fail('invalid');
	}
	const bufferPpm = numberSetting(deps, 'fx_buffer_pct');
	const usdEurPpm = fxUsdEurPpm({ bceRatePpm, bufferPpm });
	const now = deps.clock.now();
	immediateTransaction(deps.db, (tx) => {
		insertFxRecord(tx, {
			id: deps.ids('fx'),
			usdEurPpm,
			source: 'ecb',
			ecbRatePpm: bceRatePpm,
			ecbDate: fetched.timePeriod,
			bufferPpm,
			effectiveFrom: now,
			createdBy: null,
			createdAt: now
		});
	});
	deps.logger.emit('pricing.fx.refreshed', {});
	clearAlert(deps.alerts, alertKeys.fxStale());
	return { status: 'updated', usdEurPpm };
}

/** Fija un tipo manual que sustituye al automático hasta que se desactive (BE-FR-87 CA3), con su auditoría. */
export function setManualFx(
	deps: PricingDeps,
	input: { readonly adminId: string; readonly usdEurPpm: number; readonly reason: string }
): void {
	const now = deps.clock.now();
	immediateTransaction(deps.db, (tx) => {
		const before = getCurrentFxRate(deps).usdEurPpm;
		const id = deps.ids('fx');
		insertFxRecord(tx, {
			id,
			usdEurPpm: input.usdEurPpm,
			source: 'manual',
			ecbRatePpm: null,
			ecbDate: null,
			bufferPpm: null,
			effectiveFrom: now,
			createdBy: input.adminId,
			createdAt: now
		});
		recordEntry(
			tx,
			{
				adminId: input.adminId,
				action: 'pricing.fx.manual_set',
				entity: 'fx_rate',
				entityId: id,
				before: { usdEurPpm: before },
				after: { usdEurPpm: input.usdEurPpm },
				reason: input.reason
			},
			deps.audit
		);
	});
	deps.logger.emit('pricing.fx.manual_set', {});
}

/**
 * Desactiva el manual: inserta una fila `ecb` con el último valor del BCE (BE-FR-87 CA3). Sin ningún valor del BCE no hay
 * a qué volver, y no se hace nada.
 */
export function clearManualFx(
	deps: PricingDeps,
	input: { readonly adminId: string; readonly reason: string }
): { readonly ok: boolean } {
	const now = deps.clock.now();
	const outcome = immediateTransaction(deps.db, (tx) => {
		const last = lastEcbRecord(tx);
		if (
			last === undefined ||
			last.ecbRatePpm === null ||
			last.ecbDate === null ||
			last.bufferPpm === null
		)
			return { ok: false };
		const before = getCurrentFxRate(deps).usdEurPpm;
		insertFxRecord(tx, {
			id: deps.ids('fx'),
			usdEurPpm: last.usdEurPpm,
			source: 'ecb',
			ecbRatePpm: last.ecbRatePpm,
			ecbDate: last.ecbDate,
			bufferPpm: last.bufferPpm,
			effectiveFrom: now,
			createdBy: null,
			createdAt: now
		});
		recordEntry(
			tx,
			{
				adminId: input.adminId,
				action: 'pricing.fx.manual_cleared',
				entity: 'fx_rate',
				entityId: null,
				before: { usdEurPpm: before },
				after: { usdEurPpm: last.usdEurPpm },
				reason: input.reason
			},
			deps.audit
		);
		return { ok: true };
	});
	if (outcome.ok) deps.logger.emit('pricing.fx.manual_cleared', {});
	return outcome;
}

/**
 * Cobro en créditos de un coste en micro-USD (BE-FR-19): comisión del proveedor, tipo vigente, margen de la operación
 * (o el global) y créditos por euro de consumo. Sirve al cobro real y a la estimación del coste máximo.
 */
export function chargeFor(
	deps: PricingDeps,
	input: {
		readonly appId: string;
		readonly operationKey: string;
		readonly costMicroUsd: number;
		readonly provider: Provider;
	}
): { readonly chargeMicro: number; readonly fxRateId: string | null } {
	const effective = getEffectiveConfig(deps.apps, {
		appId: input.appId,
		operationKey: input.operationKey
	});
	const feeKey =
		input.provider === 'openrouter' ? 'provider_fee_pct_openrouter' : 'provider_fee_pct_mistral';
	const fx = getCurrentFxRate(deps);
	const chargeMicro = computeCharge({
		costMicroUsd: input.costMicroUsd,
		providerFeePpm: numberSetting(deps, feeKey),
		fxUsdEurPpm: fx.usdEurPpm,
		marginPpm: marginFor({
			operationMarginPpm: effective.operation?.marginPpm ?? null,
			globalMarginPpm: numberSetting(deps, 'margin_global')
		}),
		creditsPerEurUsage: numberSetting(deps, 'credits_per_eur_usage')
	});
	return { chargeMicro, fxRateId: fx.fxRateId };
}

/** Tipo USD→EUR (ppm) con el que se hizo una operación, por su `fx_rate_id` (T316). Nulo si no existe. */
export function usdEurPpmOf(deps: PricingDeps, fxRateId: string): number | null {
	return usdEurPpmOfRate(deps.db, fxRateId);
}

/** Guarda el precio de referencia calculado por la tarea diaria, en una transacción (BE-FR-73). El valor manual no se toca. */
export function savePriceReference(
	deps: { readonly db: Db },
	input: {
		readonly operationId: string;
		readonly typicalMicro: number | null;
		readonly source: 'auto' | 'manual' | null;
		readonly sampleSize: number;
		readonly computedAt: number;
	}
): void {
	immediateTransaction(deps.db, (tx) => {
		upsertPriceReference(tx, input);
	});
}

/** Valor manual del coste típico de una operación, para el cálculo diario (BE-FR-73). */
export function manualPriceFor(deps: { readonly db: Db }, operationId: string): number | null {
	return manualPriceOf(deps.db, operationId);
}
