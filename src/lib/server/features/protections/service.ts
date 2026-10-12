// Protecciones de la API (FR-069, FR-072, FR-073, FR-074, BE-FR-43, BE-FR-46 a BE-FR-48; T191–T202). Se componen desde el
// servicio de `ai` (pasos 6 a 8 de §8), nunca desde las rutas ni desde el cierre de sesión o `/app/status`.
import type { Clock } from '$lib/server/adapters/clock/clock';
import type { Db } from '$lib/server/db/client';
import { immediateTransaction } from '$lib/server/db/tx';
import { recordEntry, type AuditDeps } from '$lib/server/features/audit';
import {
	appAccessOf,
	getEffectiveConfig,
	getSetting,
	type AppsDeps
} from '$lib/server/features/apps';
import type { Credits } from '$lib/server/features/credits';
import { alertKeys, raiseAlert, type AlertDeps } from '$lib/server/features/notifications';
import type { Logger } from '$lib/server/logging/logger';
import { AppError } from '$lib/server/shared/errors';
import { addDays, civilDateOf, madridMidnight } from '$lib/shared/dates';
import { toEpochMs, type CivilDate, type EpochMs } from '$lib/shared/time';
import { maintenanceVerdict, versionVerdict, type EndpointName } from './domain/access';
import { brakeVerdict, eurCentsOf } from './domain/brake';
import { concurrencyVerdict, twoLevelRateVerdict } from './domain/limits';
import { createRateWindows, RATE_WINDOW_MS, type RateWindows } from './rate-limit.cache';
import { createTranscriptionSlots, type TranscriptionSlots } from './concurrency.cache';
import { GLOBAL_BRAKE_KEY, readBrakeState, writeBrakeState } from './repository';

/** Segundos de `Retry-After` cuando se rechaza por ranuras de transcripción ocupadas (no hay un plazo que calcular). */
export const CONCURRENCY_RETRY_AFTER_SECONDS = 5;

/** Estado en memoria de las protecciones de frecuencia y concurrencia. Lo crea la composición una vez por proceso. */
export interface ProtectionsRuntime {
	readonly rate: RateWindows;
	readonly slots: TranscriptionSlots;
}

export function createProtectionsRuntime(): ProtectionsRuntime {
	return { rate: createRateWindows(), slots: createTranscriptionSlots() };
}

/**
 * Coste real por cuenta de un día (USD micro), aportado por `ai` como puerto: `protections` no lee las tablas de `ai`.
 * Las cuentas sin compra real se separan después con `credits`.
 */
export interface DailyCostPort {
	costByUserOfDay(
		from: EpochMs,
		until: EpochMs
	): readonly { readonly userId: string; readonly costMicroUsd: number }[];
}

export interface ProtectionsDeps {
	readonly db: Db;
	readonly clock: Clock;
	readonly logger: Logger;
	readonly apps: AppsDeps;
	readonly credits: Credits;
	readonly alerts: AlertDeps;
	readonly dailyCosts: DailyCostPort;
	readonly runtime: ProtectionsRuntime;
}

/**
 * Comprueba la versión mínima y después el mantenimiento de un endpoint de la app. Lanza `UPGRADE_REQUIRED` (426) o
 * `MAINTENANCE` (503) con el texto del administrador. Los endpoints exentos pasan siempre (`ENDPOINT_CHECKS`).
 */
export function guardAccess(
	deps: Pick<ProtectionsDeps, 'apps' | 'logger'>,
	input: {
		readonly endpoint: EndpointName;
		readonly appId: string;
		readonly appVersion: string | null;
	}
): void {
	const access = appAccessOf(deps.apps, input.appId);
	if (access === undefined) throw new AppError('UNKNOWN_APP', { field: 'app' });

	const version = versionVerdict({
		endpoint: input.endpoint,
		appVersion: input.appVersion,
		enforce: access.enforceVersion,
		minAppVersion: access.minAppVersion
	});
	if (!version.ok) {
		deps.logger.emit('protections.request.rejected', { reason: version.reason });
		throw new AppError('UPGRADE_REQUIRED');
	}

	const maintenance = maintenanceVerdict({
		endpoint: input.endpoint,
		global: access.globalMaintenance,
		app: access.maintenance
	});
	if (!maintenance.ok) {
		deps.logger.emit('protections.request.rejected', { reason: maintenance.reason });
		throw new AppError('MAINTENANCE', { message: maintenance.message });
	}
}

export interface RequestGuardInput {
	readonly endpoint: EndpointName;
	readonly appId: string;
	readonly appVersion: string | null;
	readonly userId: string;
	/** Una transcripción ocupa una ranura de concurrencia hasta que su llamador la libera. */
	readonly transcription: boolean;
}

/**
 * Pasos de protección de una petición de IA, en orden: versión y mantenimiento, freno global, frecuencia y, en
 * transcripciones, concurrencia. Devuelve la liberación de la ranura (no hace nada si no hay). El llamador la libera en
 * un `finally`.
 */
export function guardRequest(deps: ProtectionsDeps, input: RequestGuardInput): () => void {
	guardAccess(deps, input);
	const now = toEpochMs(deps.clock.now());
	guardBrake(deps, now);
	const limits = effectiveLimits(deps, input.appId);
	checkRate(deps, input, now, limits);
	const release = input.transcription ? acquireSlot(deps, input, limits) : () => undefined;
	deps.runtime.rate.record(input.userId, input.appId, now);
	return release;
}

/**
 * Freno global de gasto (BE-FR-46): el coste real del día de las cuentas sin compra real más sus reservas en curso.
 * Al cruzar el límite se activa, se guarda, avisa una vez al administrador y rechaza. Hasta el cambio de día, o una
 * liberación manual, sigue activo.
 */
function guardBrake(deps: ProtectionsDeps, now: EpochMs): void {
	const day = civilDateOf(now);
	const stored = readBrakeState(deps.db);
	// Mientras el freno esté activo hoy no hace falta volver a sumar el día: la respuesta es la misma.
	if (stored !== null && stored.day === day && stored.active) rejectBraked(deps);

	const verdict = brakeVerdict({
		freeCostCents: freeAccountsCostCents(deps, day),
		limitCents: numberSetting(deps, 'global_daily_free_cost_brake_eur'),
		stored,
		today: day
	});
	if (!verdict.active) return;
	if (verdict.trip) {
		immediateTransaction(deps.db, (tx) => {
			writeBrakeState(
				tx,
				{ day, active: true, activatedAt: now, releasedAt: null, releasedBy: null },
				now
			);
		});
		deps.logger.emit('protections.brake.activated', {});
		// El aviso no retrasa el rechazo: sale en segundo plano y, si falla, queda registrado.
		raiseAlert(deps.alerts, { key: alertKeys.globalBrake(day), detail: day }).catch(() => {
			deps.logger.emit('protections.brake.alert_failed', {});
		});
	}
	rejectBraked(deps);
}

function rejectBraked(deps: ProtectionsDeps): never {
	deps.logger.emit('protections.request.rejected', { reason: 'brake_active' });
	throw new AppError('SERVICE_LIMITED');
}

/** Céntimos de euro del día: coste real de las cuentas sin compra real más sus reservas en curso (1 € = 1.000 créditos). */
function freeAccountsCostCents(deps: ProtectionsDeps, day: CivilDate): number {
	const rows = deps.dailyCosts.costByUserOfDay(
		madridMidnight(day),
		madridMidnight(addDays(day, 1))
	);
	const paying = deps.credits.realPurchaseUserIds(rows.map((row) => row.userId));
	const fxUsdEurPpm = numberSetting(deps, 'fx_usd_eur');
	const realCents = rows
		.filter((row) => !paying.has(row.userId))
		.reduce((sum, row) => sum + eurCentsOf({ costMicroUsd: row.costMicroUsd, fxUsdEurPpm }), 0);
	// Micro-créditos reservados: 1 € = 1.000 créditos = 1.000.000.000 µc, así que un céntimo son 10.000.000 µc.
	const holdCents = Math.ceil(deps.credits.freeAccountsOpenHoldsMicro() / 10_000_000);
	return realCents + holdCents;
}

interface EffectiveLimits {
	readonly ai_requests_per_minute: number;
	readonly max_concurrent_transcriptions: number;
}

/** Límites que aplican a la app: el valor de la app (nunca mayor que el global) o el global si no tiene uno propio. */
function effectiveLimits(deps: ProtectionsDeps, appId: string): EffectiveLimits {
	const settings = getEffectiveConfig(deps.apps, { appId }).settings;
	return {
		ai_requests_per_minute: settings.ai_requests_per_minute,
		max_concurrent_transcriptions: settings.max_concurrent_transcriptions
	};
}

/** Frecuencia por minuto (BE-FR-43): el límite de la cuenta suma todas sus apps; el de la app solo cuenta las suyas. */
function checkRate(
	deps: ProtectionsDeps,
	input: RequestGuardInput,
	now: EpochMs,
	limits: EffectiveLimits
): void {
	const verdict = twoLevelRateVerdict({
		now,
		windowMs: RATE_WINDOW_MS,
		account: {
			limit: numberSetting(deps, 'ai_requests_per_minute'),
			timestamps: deps.runtime.rate.accountTimes(input.userId, now)
		},
		app: {
			limit: limits.ai_requests_per_minute,
			timestamps: deps.runtime.rate.appTimes(input.userId, input.appId, now)
		}
	});
	if (!verdict.ok) {
		deps.logger.emit('protections.request.rejected', { reason: verdict.reason });
		throw new AppError('RATE_LIMITED', { retryAfterSeconds: verdict.retryAfterSeconds });
	}
}

/** Transcripciones simultáneas (BE-FR-43): la cuenta suma todas sus apps; la app cuenta solo las suyas. */
function acquireSlot(
	deps: ProtectionsDeps,
	input: RequestGuardInput,
	limits: EffectiveLimits
): () => void {
	const inFlight = deps.runtime.slots.inFlight(input.userId, input.appId);
	const verdict = concurrencyVerdict({
		accountInFlight: inFlight.account,
		appInFlight: inFlight.app,
		accountLimit: numberSetting(deps, 'max_concurrent_transcriptions'),
		appLimit: limits.max_concurrent_transcriptions
	});
	if (!verdict.ok) {
		deps.logger.emit('protections.request.rejected', { reason: verdict.reason });
		throw new AppError('RATE_LIMITED', { retryAfterSeconds: CONCURRENCY_RETRY_AFTER_SECONDS });
	}
	return deps.runtime.slots.acquire(input.userId, input.appId);
}

export interface BrakeReleaseDeps {
	readonly db: Db;
	readonly clock: Clock;
	readonly logger: Logger;
	readonly audit: AuditDeps;
}

/**
 * Liberación manual del freno por un administrador, con auditoría (BE-FR-46 CA2). Devuelve `false` si el freno no está
 * activo hoy. La interfaz de administración es de L13.
 */
export function releaseBrake(deps: BrakeReleaseDeps, adminId: string): boolean {
	const now = toEpochMs(deps.clock.now());
	const day = civilDateOf(now);
	const released = immediateTransaction(deps.db, (tx) => {
		const stored = readBrakeState(tx);
		if (stored === null || stored.day !== day || !stored.active) return false;
		writeBrakeState(tx, { ...stored, active: false, releasedAt: now, releasedBy: adminId }, now);
		recordEntry(
			tx,
			{
				adminId,
				action: 'protections.brake.released',
				entity: 'protection_state',
				entityId: GLOBAL_BRAKE_KEY,
				before: { active: true },
				after: { active: false },
				reason: 'manual'
			},
			deps.audit
		);
		return true;
	});
	if (released) deps.logger.emit('protections.brake.released', { reason: 'manual' });
	return released;
}

function numberSetting(
	deps: Pick<ProtectionsDeps, 'apps'>,
	key: Parameters<typeof getSetting>[1]
): number {
	const value = getSetting(deps.apps, key);
	if (typeof value !== 'number')
		throw new AppError('INTERNAL_ERROR', { reason: 'setting_missing' });
	return value;
}
