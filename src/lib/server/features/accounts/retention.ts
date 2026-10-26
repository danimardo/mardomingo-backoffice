// Retención y limpieza de los datos propios de `accounts` (BE-FR-68, BE-FR-83, BE-FR-86; data-model §6; T293, T294, T296). Las
// llama `privacy` (retención e inactividad) y la tarea de cuentas sin verificar. Cada función escribe solo tablas de `accounts`
// y devuelve cuántas filas tocó; `privacy` registra el resultado por categoría.
import { and, eq, isNotNull, isNull, lt, lte, notLike, or, sql } from 'drizzle-orm';
import { immediateTransaction } from '$lib/server/db/tx';
import { DAY_MS } from '$lib/shared/dates';
import type { EpochMs } from '$lib/shared/time';
import { authRateLimits, loginAttempts, session, user, verification } from './schema';
import type { AccountsBase } from './service';

type Deps = Pick<AccountsBase, 'db' | 'logger' | 'clock'>;

/**
 * Cuentas sin verificar con más de `ttlDays` días: se borran por completo (BE-FR-68). Sus aceptaciones, sesiones y credencial
 * caen en cascada, y el email queda libre. Una cuenta con algún dato que la retenga (no debería existir sin verificar) se
 * conserva y se registra: nunca se aborta la limpieza de las demás.
 */
export function purgeUnverified(deps: Deps, ttlDays: number): number {
	const now = deps.clock.now();
	const cutoff = now - ttlDays * DAY_MS;
	const candidates = deps.db
		.select({ id: user.id })
		.from(user)
		.where(
			and(
				eq(user.emailVerified, false),
				isNull(user.deletedAt),
				lt(user.createdAt, new Date(cutoff))
			)
		)
		.all();
	let purged = 0;
	for (const { id } of candidates) {
		try {
			immediateTransaction(deps.db, (tx) => {
				// Los tokens de recuperación y de cambio de email guardan el id del usuario en el valor (como en el borrado).
				tx.delete(verification)
					.where(
						sql`${verification.value} = ${id} OR CASE WHEN json_valid(${verification.value}) THEN json_extract(${verification.value}, '$.userId') END = ${id}`
					)
					.run();
				purged += tx.delete(user).where(eq(user.id, id)).run().changes;
			});
		} catch (error) {
			deps.logger.emit('accounts.unverified.purge_skipped', { err: error });
		}
	}
	deps.logger.emit('accounts.unverified.purged', { count: purged });
	return purged;
}

/** Sesiones caducadas hace más de 30 días, con su IP y su equipo (BE-FR-83). Las revocadas ya no existen. */
export function purgeExpiredSessions(deps: Deps, before: EpochMs): number {
	return immediateTransaction(
		deps.db,
		(tx) =>
			tx
				.delete(session)
				.where(lt(session.expiresAt, new Date(before)))
				.run().changes
	);
}

/**
 * Contadores de límites por IP y de intentos fallidos de inicio de sesión de más de 24 h. Un bloqueo todavía vigente se
 * conserva aunque su ventana sea antigua: borrarlo desbloquearía la cuenta antes de tiempo (BE-FR-67).
 */
export function purgeAuthAttempts(deps: Deps, before: EpochMs): number {
	const now = deps.clock.now();
	return immediateTransaction(deps.db, (tx) => {
		const limits = tx.delete(authRateLimits).where(lt(authRateLimits.windowStart, before)).run();
		const attempts = tx
			.delete(loginAttempts)
			.where(
				and(
					lt(loginAttempts.windowStart, before),
					or(isNull(loginAttempts.lockedUntil), lte(loginAttempts.lockedUntil, now))
				)
			)
			.run();
		return limits.changes + attempts.changes;
	});
}

/** Tokens de verificación y recuperación caducados. */
export function purgeExpiredVerifications(deps: Deps, before: EpochMs): number {
	return immediateTransaction(
		deps.db,
		(tx) =>
			tx
				.delete(verification)
				.where(lt(verification.expiresAt, new Date(before)))
				.run().changes
	);
}

export interface InactivityCandidate {
	readonly userId: string;
	/** Última actividad, o el alta si nunca hubo (`last_activity_at` nulo). */
	readonly referenceAt: number;
	readonly warnedAt: number | null;
}

/**
 * Cuentas que pueden estar inactivas (BE-FR-86): verificadas, vivas, sin bloqueo y que no son la del administrador, cuya
 * última actividad es anterior al corte o que ya recibieron el aviso. `privacy` descarta las que tienen compra real y decide
 * qué hacer con cada una.
 */
export function inactivityCandidates(deps: Deps, cutoff: EpochMs): InactivityCandidate[] {
	const reference = sql<number>`coalesce(${user.lastActivityAt}, ${user.createdAt})`;
	return deps.db
		.select({
			userId: user.id,
			referenceAt: reference,
			warnedAt: user.inactivityWarnedAt
		})
		.from(user)
		.where(
			and(
				eq(user.emailVerified, true),
				eq(user.banned, false),
				isNull(user.deletedAt),
				notLike(user.role, '%admin%'),
				or(sql`${reference} <= ${cutoff}`, isNotNull(user.inactivityWarnedAt))
			)
		)
		.all();
}

/** Anota el aviso de inactividad enviado. */
export function markInactivityWarned(deps: Deps, userId: string, at: EpochMs): void {
	immediateTransaction(deps.db, (tx) => {
		tx.update(user).set({ inactivityWarnedAt: at }).where(eq(user.id, userId)).run();
	});
}

/** Retira el aviso de inactividad: hubo actividad durante el plazo y el borrado queda cancelado (BE-FR-86 CA2). */
export function clearInactivityWarning(deps: Deps, userId: string): void {
	immediateTransaction(deps.db, (tx) => {
		tx.update(user).set({ inactivityWarnedAt: null }).where(eq(user.id, userId)).run();
	});
}
