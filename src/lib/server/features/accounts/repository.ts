// Acceso a los datos propios de `accounts`: contadores por IP, intentos fallidos, dominios desechables, actividad por
// app y altas por IP. Solo toca tablas de `accounts`. Las lecturas van por `Db` y las escrituras por `Tx`.
import { and, count, eq, gte, sql } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import type { Tx } from '$lib/server/db/tx';
import { toEpochMs, type EpochMs } from '$lib/shared/time';
import {
	isLoginLocked,
	nextLoginAttempt,
	refundLoginAttempt,
	signupIpLimitReached,
	type LoginAttemptResult
} from './domain/abuse';
import {
	account,
	authRateLimits,
	disposableDomains,
	loginAttempts,
	session,
	user,
	userAppActivity,
	type AUTH_RATE_SCOPES
} from './schema';

export type AuthRateScope = (typeof AUTH_RATE_SCOPES)[number];

const DAY_MS = 86_400_000;

/** Altas registradas desde una IP en las últimas 24 h (BE-FR-11.4), contadas sobre `user.signup_ip`. */
function countSignupsFromIp(tx: Tx, ip: string, now: EpochMs): number {
	const since = toEpochMs(now - DAY_MS);
	return (
		tx
			.select({ total: count() })
			.from(user)
			.where(and(eq(user.signupIp, ip), gte(user.createdAt, new Date(since))))
			.get()?.total ?? 0
	);
}

const signupSlotOf = (ip: string) =>
	and(eq(authRateLimits.scope, 'signup'), eq(authRateLimits.ip, ip));

/**
 * Reserva atómica de un hueco de alta desde una IP (BE-FR-11.4, BE-FR-45; C-21). Cuenta las altas ya creadas en 24 h más las
 * que están en curso (fila `signup` de `auth_rate_limits`) y, si caben, suma una en curso. `releaseSignupSlot` la quita al
 * terminar: si el alta se creó, en la misma transacción que escribe `signup_ip`, así que el hueco pasa de «en curso» a
 * «creada» sin un instante en que no cuente. Las reservas en curso dejan de contar `pendingTtlMs` después de la última (un
 * proceso caído a mitad de un alta no retiene el hueco para siempre).
 */
export function reserveSignupSlot(
	tx: Tx,
	ip: string,
	now: EpochMs,
	options: { readonly limit: number; readonly pendingTtlMs: number }
): boolean {
	const row = tx.select().from(authRateLimits).where(signupSlotOf(ip)).get();
	const pending = row !== undefined && row.windowStart > now - options.pendingTtlMs ? row.count : 0;
	if (signupIpLimitReached(countSignupsFromIp(tx, ip, now) + pending, options.limit)) return false;
	tx.insert(authRateLimits)
		.values({ scope: 'signup', ip, count: pending + 1, windowStart: now })
		.onConflictDoUpdate({
			target: [authRateLimits.scope, authRateLimits.ip],
			set: { count: pending + 1, windowStart: now }
		})
		.run();
	return true;
}

/** Quita una reserva de alta en curso (`reserveSignupSlot`); sin reservas en curso, la fila desaparece. */
export function releaseSignupSlot(tx: Tx, ip: string): void {
	const row = tx.select().from(authRateLimits).where(signupSlotOf(ip)).get();
	if (row === undefined) return;
	if (row.count <= 1) {
		tx.delete(authRateLimits).where(signupSlotOf(ip)).run();
		return;
	}
	tx.update(authRateLimits)
		.set({ count: row.count - 1 })
		.where(signupSlotOf(ip))
		.run();
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

export type LoginAttemptReservation =
	| { readonly kind: 'locked'; readonly failures: number; readonly lockedUntil: EpochMs }
	| { readonly kind: 'reserved'; readonly state: LoginAttemptResult };

function loginAttemptOf(tx: Tx, emailHash: string): LoginAttemptResult | undefined {
	const row = tx
		.select()
		.from(loginAttempts)
		.where(eq(loginAttempts.emailNormalizedHash, emailHash))
		.get();
	if (row === undefined) return undefined;
	return { failures: row.failures, windowStart: row.windowStart, lockedUntil: row.lockedUntil };
}

/**
 * Reserva atómica de un intento con contraseña (BE-FR-45, BE-FR-67; C-16), exista o no la cuenta. Con un bloqueo vigente no
 * suma nada. Si no, cuenta el intento como fallo ANTES de comprobar la contraseña: la ventana es de `windowMinutes` desde el
 * primer fallo y al llegar a `maxFailures` se bloquea `lockMinutes`. Un acierto lo borra después (`clearLoginAttempts`) y un
 * intento que no fue un fallo se devuelve (`releaseLoginAttempt`).
 */
export function reserveLoginAttempt(
	tx: Tx,
	emailHash: string,
	now: EpochMs,
	options: {
		readonly maxFailures: number;
		readonly lockMinutes: number;
		readonly windowMinutes: number;
	}
): LoginAttemptReservation {
	const current = loginAttemptOf(tx, emailHash);
	if (current !== undefined && isLoginLocked(current.lockedUntil, now)) {
		return { kind: 'locked', failures: current.failures, lockedUntil: current.lockedUntil };
	}
	const next = nextLoginAttempt(current, now, options);
	tx.insert(loginAttempts)
		.values({ emailNormalizedHash: emailHash, ...next })
		.onConflictDoUpdate({
			target: loginAttempts.emailNormalizedHash,
			set: next
		})
		.run();
	return { kind: 'reserved', state: next };
}

/** Devuelve un intento reservado que no fue un fallo (`refundLoginAttempt`). */
export function releaseLoginAttempt(tx: Tx, emailHash: string, reserved: LoginAttemptResult): void {
	const next = refundLoginAttempt(loginAttemptOf(tx, emailHash), reserved);
	if (next === undefined) return;
	const where = eq(loginAttempts.emailNormalizedHash, emailHash);
	if (next === null) tx.delete(loginAttempts).where(where).run();
	else tx.update(loginAttempts).set(next).where(where).run();
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

/**
 * Credencial de una cuenta tal como la comprueba el login de Better Auth (C-27): el usuario y el hash de su cuenta
 * `credential` (la de `account_id` igual al id del usuario). `passwordHash` es `null` si la credencial no existe.
 */
export interface LoginCredential {
	readonly userId: string;
	readonly email: string;
	readonly deletedAt: EpochMs | null;
	readonly passwordHash: string | null;
}

/** Credencial de la cuenta con ese email (`by: 'email'`, ya en minúsculas) o con ese id; `undefined` si no hay cuenta. */
export function loginCredentialOf(
	db: Db | Tx,
	by: { readonly email: string } | { readonly userId: string }
): LoginCredential | undefined {
	const row = db
		.select({
			userId: user.id,
			email: user.email,
			deletedAt: user.deletedAt,
			passwordHash: account.password
		})
		.from(user)
		.leftJoin(
			account,
			and(
				eq(account.userId, user.id),
				eq(account.providerId, 'credential'),
				eq(account.accountId, user.id)
			)
		)
		.where('email' in by ? eq(user.email, by.email) : eq(user.id, by.userId))
		.get();
	return row === undefined ? undefined : { ...row, passwordHash: row.passwordHash ?? null };
}

/** Cuenta dueña de la sesión de ese token, o `undefined` si la sesión ya no existe. */
export function sessionOwnerOf(tx: Tx, token: string): string | undefined {
	return tx.select({ userId: session.userId }).from(session).where(eq(session.token, token)).get()
		?.userId;
}

/** Borra la sesión de ese token (si existe). */
export function deleteSessionByToken(tx: Tx, token: string): void {
	tx.delete(session).where(eq(session.token, token)).run();
}

/** Marcas de una cuenta que invalidan cualquier sesión suya: borrada o bloqueada. `undefined` si la fila no existe. */
export function revocationMarksOf(
	db: Db,
	userId: string
): { readonly deleted: boolean; readonly banned: boolean } | undefined {
	const row = db
		.select({ deletedAt: user.deletedAt, banned: user.banned })
		.from(user)
		.where(eq(user.id, userId))
		.get();
	return row === undefined ? undefined : { deleted: row.deletedAt !== null, banned: row.banned };
}
