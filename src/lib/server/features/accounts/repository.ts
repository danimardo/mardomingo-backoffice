// Acceso a los datos propios de `accounts`: contadores por IP, intentos fallidos, dominios desechables, actividad por
// app y altas por IP. Solo toca tablas de `accounts`. Las lecturas van por `Db` y las escrituras por `Tx`.
import { and, count, eq, gte, sql } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import type { Tx } from '$lib/server/db/tx';
import { toEpochMs, type EpochMs } from '$lib/shared/time';
import {
	authRateLimits,
	disposableDomains,
	loginAttempts,
	user,
	userAppActivity,
	type AUTH_RATE_SCOPES
} from './schema';

export type AuthRateScope = (typeof AUTH_RATE_SCOPES)[number];

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/** Altas registradas desde una IP en las últimas 24 h (BE-FR-11.4), contadas sobre `user.signup_ip`. */
export function countSignupsFromIp(db: Db, ip: string, now: EpochMs): number {
	const since = toEpochMs(now - DAY_MS);
	return (
		db
			.select({ total: count() })
			.from(user)
			.where(and(eq(user.signupIp, ip), gte(user.createdAt, new Date(since))))
			.get()?.total ?? 0
	);
}

/** ¿Está el dominio en la lista de dominios desechables? (BE-FR-11.2). Se compara en minúsculas. */
export function isDisposableDomain(db: Db, domain: string): boolean {
	return (
		db
			.select()
			.from(disposableDomains)
			.where(eq(disposableDomains.domain, domain.toLowerCase()))
			.get() !== undefined
	);
}

/** Suma una petición a la ventana fija de (ámbito, IP) y devuelve el total y el inicio de la ventana actual. */
export function bumpRateCounter(
	tx: Tx,
	scope: AuthRateScope,
	ip: string,
	now: EpochMs,
	windowMs: number
): { readonly count: number; readonly windowStart: EpochMs } {
	const current = tx
		.select()
		.from(authRateLimits)
		.where(and(eq(authRateLimits.scope, scope), eq(authRateLimits.ip, ip)))
		.get();
	const inWindow = current !== undefined && current.windowStart > now - windowMs;
	const next = current !== undefined && inWindow ? current.count + 1 : 1;
	const windowStart = current !== undefined && inWindow ? current.windowStart : now;
	tx.insert(authRateLimits)
		.values({ scope, ip, count: next, windowStart })
		.onConflictDoUpdate({
			target: [authRateLimits.scope, authRateLimits.ip],
			set: { count: next, windowStart }
		})
		.run();
	return { count: next, windowStart };
}

/** Peticiones de la ventana actual de (ámbito, IP), sin sumar ninguna. */
export function readRateCounter(
	db: Db,
	scope: AuthRateScope,
	ip: string,
	now: EpochMs,
	windowMs: number
): number {
	const current = db
		.select()
		.from(authRateLimits)
		.where(and(eq(authRateLimits.scope, scope), eq(authRateLimits.ip, ip)))
		.get();
	if (current === undefined || current.windowStart <= now - windowMs) return 0;
	return current.count;
}

export interface LoginAttemptState {
	readonly failures: number;
	readonly lockedUntil: EpochMs | null;
}

/** Estado de los intentos de un email (por su hash), exista o no la cuenta (BE-FR-67 CA1). */
export function readLoginAttempt(db: Db, emailHash: string): LoginAttemptState | undefined {
	const row = db
		.select()
		.from(loginAttempts)
		.where(eq(loginAttempts.emailNormalizedHash, emailHash))
		.get();
	if (row === undefined) return undefined;
	return { failures: row.failures, lockedUntil: row.lockedUntil };
}

/**
 * Registra un fallo: la ventana es de `windowMinutes` desde el primer fallo; al llegar a `maxFailures` se bloquea
 * `lockMinutes`. Devuelve el estado resultante.
 */
export function recordLoginFailure(
	tx: Tx,
	emailHash: string,
	now: EpochMs,
	options: {
		readonly maxFailures: number;
		readonly lockMinutes: number;
		readonly windowMinutes: number;
	}
): LoginAttemptState {
	const current = tx
		.select()
		.from(loginAttempts)
		.where(eq(loginAttempts.emailNormalizedHash, emailHash))
		.get();
	const inWindow =
		current !== undefined && current.windowStart > now - options.windowMinutes * MINUTE_MS;
	const failures = current !== undefined && inWindow ? current.failures + 1 : 1;
	const windowStart = current !== undefined && inWindow ? current.windowStart : now;
	const lockedUntil =
		failures >= options.maxFailures ? toEpochMs(now + options.lockMinutes * MINUTE_MS) : null;
	tx.insert(loginAttempts)
		.values({ emailNormalizedHash: emailHash, failures, windowStart, lockedUntil })
		.onConflictDoUpdate({
			target: loginAttempts.emailNormalizedHash,
			set: { failures, windowStart, lockedUntil }
		})
		.run();
	return { failures, lockedUntil };
}

/** Un login correcto o una recuperación completada ponen el contador a cero (BE-FR-67 CA2). */
export function clearLoginAttempts(tx: Tx, emailHash: string): void {
	tx.delete(loginAttempts).where(eq(loginAttempts.emailNormalizedHash, emailHash)).run();
}

/** Primer login y último uso de una cuenta desde una app (D-13; L04 lo llama al entrar desde una app). */
export function recordAppActivity(tx: Tx, userId: string, appId: string, now: EpochMs): void {
	tx.insert(userAppActivity)
		.values({ userId, appId, firstLoginAt: now, lastUsedAt: now })
		.onConflictDoUpdate({
			target: [userAppActivity.userId, userAppActivity.appId],
			set: { lastUsedAt: now }
		})
		.run();
}

/** Guarda los datos que Better Auth no conoce: forma normalizada, app de origen y IP del alta (BE-FR-11, BE-FR-64). */
export function setSignupMetadata(
	tx: Tx,
	userId: string,
	metadata: {
		readonly emailNormalized: string;
		readonly signupAppId: string | null;
		readonly signupIp: string | null;
	}
): void {
	tx.update(user)
		.set({
			emailNormalized: metadata.emailNormalized,
			signupAppId: metadata.signupAppId,
			signupIp: metadata.signupIp
		})
		.where(eq(user.id, userId))
		.run();
}

/** Inserta dominios desechables sin tocar los que ya estén (la lista se refresca sin redesplegar, BE-FR-11.2). */
export function insertDisposableDomains(tx: Tx, domains: readonly string[], now: EpochMs): void {
	for (const domain of domains) {
		tx.insert(disposableDomains).values({ domain, updatedAt: now }).onConflictDoNothing().run();
	}
}

/** Número de filas de un ámbito de contadores (útil para las pruebas). */
export function countRateRows(db: Db): number {
	return (
		db
			.select({ total: sql<number>`count(*)` })
			.from(authRateLimits)
			.get()?.total ?? 0
	);
}
