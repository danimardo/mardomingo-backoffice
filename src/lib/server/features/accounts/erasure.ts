// Borrado y exportación de los datos propios de `accounts` (BE-FR-07, BE-FR-08; data-model §6; T283). Solo las llama
// `privacy`: la contraseña se comprueba fuera de la transacción (el hash es asíncrono) y el resto se ejecuta dentro de la de
// `privacy`, donde cada transacción de este módulo pasa a ser un punto de guardado.
import { and, eq, sql } from 'drizzle-orm';
import { verifyPassword } from 'better-auth/crypto';
import { immediateTransaction } from '$lib/server/db/tx';
import { account, session, user, userAppActivity, verification } from './schema';
import type { AccountsDeps } from './service';

/** ¿Es la contraseña la de la cuenta? Sin cuenta o sin contraseña (alta futura con Google) no coincide nunca. */
export async function passwordMatches(
	deps: AccountsDeps,
	userId: string,
	password: string
): Promise<boolean> {
	const row = deps.db
		.select({ hash: account.password })
		.from(account)
		.where(and(eq(account.userId, userId), eq(account.providerId, 'credential')))
		.get();
	const hash: string | null | undefined = row?.hash;
	return hash != null && (await verifyPassword({ hash, password }));
}

/** Cierra todas las sesiones de la cuenta, de cualquier app. Devuelve cuántas había. */
export function revokeAllSessions(deps: AccountsDeps, userId: string): number {
	const count = immediateTransaction(
		deps.db,
		(tx) => tx.delete(session).where(eq(session.userId, userId)).run().changes
	);
	deps.logger.emit('accounts.session.revoked', { reason: 'account_deleted', count });
	return count;
}

/**
 * Borra la cookie de sesión de esta petición tras borrar la cuenta. Las sesiones ya no existen en la base de datos; solo queda
 * la cookie del navegador. No registra un cierre de sesión (ya lo hizo `revokeAllSessions`) y no falla si no hay nada que cerrar.
 */
export async function clearSessionCookie(deps: AccountsDeps, headers: Headers): Promise<void> {
	try {
		await deps.auth.api.signOut({ headers });
	} catch {
		// Sin sesión que cerrar: la cuenta ya no existe y el navegador quedará sin sesión de todos modos.
	}
}

/**
 * Anonimiza la fila de `user` como el data-model §6 y borra lo que cuelga solo de la cuenta: la credencial (hash de la
 * contraseña), los tokens de verificación, de recuperación y de cambio de email, y la actividad por app. Se conservan `id`,
 * `created_at`, `signup_app_id` y `signup_ip`. Devuelve `false` si la cuenta no existe o ya estaba borrada (idempotente).
 */
export function anonymizeUser(deps: AccountsDeps, userId: string): boolean {
	return immediateTransaction(deps.db, (tx) => {
		const current = tx
			.select({ deletedAt: user.deletedAt })
			.from(user)
			.where(eq(user.id, userId))
			.get();
		if (current === undefined || current.deletedAt !== null) return false;

		tx.delete(account).where(eq(account.userId, userId)).run();
		// Los tokens de recuperación guardan el id del usuario como valor; los de cambio de email, un JSON con `userId`.
		tx.delete(verification)
			.where(
				sql`${verification.value} = ${userId} OR CASE WHEN json_valid(${verification.value}) THEN json_extract(${verification.value}, '$.userId') END = ${userId}`
			)
			.run();
		tx.delete(userAppActivity).where(eq(userAppActivity.userId, userId)).run();
		tx.update(user)
			.set({
				email: `deleted+${userId}@invalid`,
				name: '',
				image: null,
				emailNormalized: null,
				lastActivityAt: null,
				inactivityWarnedAt: null,
				banReason: null,
				role: 'user',
				deletedAt: deps.clock.now(),
				updatedAt: new Date(deps.clock.now())
			})
			.where(eq(user.id, userId))
			.run();
		return true;
	});
}

export interface ProfileExport {
	readonly id: string;
	readonly email: string;
	readonly name: string;
	readonly emailVerified: boolean;
	readonly createdAt: string;
	readonly signupAppId: string | null;
	readonly signupIp: string | null;
	readonly lastActivityAt: string | null;
	readonly apps: readonly {
		readonly appId: string;
		readonly firstLoginAt: string;
		readonly lastUsedAt: string;
	}[];
	readonly sessions: readonly {
		readonly appId: string | null;
		readonly deviceName: string | null;
		readonly appVersion: string | null;
		readonly ipAddress: string | null;
		readonly userAgent: string | null;
		readonly createdAt: string;
		readonly expiresAt: string;
		readonly lastUsedAt: string | null;
	}[];
}

/** Perfil de la cuenta para la exportación RGPD (BE-FR-08). Sin hash de contraseña ni tokens de sesión. */
export function exportProfile(deps: AccountsDeps, userId: string): ProfileExport | null {
	const row = deps.db.select().from(user).where(eq(user.id, userId)).get();
	if (row === undefined) return null;
	const iso = (ms: number): string => new Date(ms).toISOString();
	return {
		id: row.id,
		email: row.email,
		name: row.name,
		emailVerified: row.emailVerified,
		createdAt: row.createdAt.toISOString(),
		signupAppId: row.signupAppId,
		signupIp: row.signupIp,
		lastActivityAt: row.lastActivityAt === null ? null : iso(row.lastActivityAt),
		apps: deps.db
			.select()
			.from(userAppActivity)
			.where(eq(userAppActivity.userId, userId))
			.orderBy(userAppActivity.appId)
			.all()
			.map((item) => ({
				appId: item.appId,
				firstLoginAt: iso(item.firstLoginAt),
				lastUsedAt: iso(item.lastUsedAt)
			})),
		sessions: deps.db
			.select()
			.from(session)
			.where(eq(session.userId, userId))
			.orderBy(session.createdAt)
			.all()
			.map((item) => ({
				appId: item.appId,
				deviceName: item.deviceName,
				appVersion: item.appVersion,
				ipAddress: item.ipAddress,
				userAgent: item.userAgent,
				createdAt: item.createdAt.toISOString(),
				expiresAt: item.expiresAt.toISOString(),
				lastUsedAt: item.lastUsedAt === null ? null : iso(item.lastUsedAt)
			}))
	};
}
