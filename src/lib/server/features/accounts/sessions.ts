// Sesiones de la cuenta para el panel (BE-FR-49.2; T264). Solo lee la tabla `session` de `accounts`: sin token, sin IP completa
// (se muestra la aproximada de `shared/approx-ip`) y solo las vigentes.
import { and, desc, eq, gt, ne } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import { approximateIp } from '$lib/server/shared/approx-ip';
import { toEpochMs, type EpochMs } from '$lib/shared/time';
import { session } from './schema';

export interface SessionView {
	readonly id: string;
	readonly createdAt: EpochMs;
	readonly lastUsedAt: EpochMs | null;
	readonly deviceName: string | null;
	readonly approxIp: string | null;
	readonly userAgent: string | null;
}

export function sessionsOf(db: Db, userId: string, now: EpochMs): SessionView[] {
	return db
		.select({
			id: session.id,
			createdAt: session.createdAt,
			lastUsedAt: session.lastUsedAt,
			deviceName: session.deviceName,
			ipAddress: session.ipAddress,
			userAgent: session.userAgent
		})
		.from(session)
		.where(and(eq(session.userId, userId), gt(session.expiresAt, new Date(now))))
		.orderBy(desc(session.createdAt), desc(session.id))
		.all()
		.map((row) => ({
			id: row.id,
			createdAt: toEpochMs(row.createdAt.getTime()),
			lastUsedAt: row.lastUsedAt,
			deviceName: row.deviceName,
			approxIp: row.ipAddress === null ? null : approximateIp(row.ipAddress),
			userAgent: row.userAgent
		}));
}

/**
 * Cierra una sesión de la cuenta desde W26. Nunca cierra la sesión que está usando la persona () ni una de otra cuenta
 * ().
 */
export function closeOtherSession(
	db: Db,
	input: {
		readonly userId: string;
		readonly sessionId: string;
		readonly currentSessionId: string | null;
	}
): 'closed' | 'current' | 'not_found' {
	if (input.sessionId === input.currentSessionId) return 'current';
	const owned = db
		.select({ id: session.id })
		.from(session)
		.where(and(eq(session.id, input.sessionId), eq(session.userId, input.userId)))
		.get();
	if (owned === undefined) return 'not_found';
	db.delete(session)
		.where(
			and(
				eq(session.id, input.sessionId),
				eq(session.userId, input.userId),
				ne(session.id, input.currentSessionId ?? '')
			)
		)
		.run();
	return 'closed';
}
