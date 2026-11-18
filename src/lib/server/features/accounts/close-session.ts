// Cierre de una sesión desde W26 (T264; BE-FR-49.2). Nunca cierra la sesión que usa la persona (`current`) ni una de otra
// cuenta (`not_found`). Solo toca la tabla `session` de `accounts`.
import { and, eq, ne } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import type { Logger } from '$lib/server/logging/logger';
import { session } from './schema';

/** Lo que necesitan los cierres de sesión: la base y el logger (cada revocación se registra, C-31). */
export interface CloseSessionDeps {
	readonly db: Db;
	readonly logger: Logger;
}

/** Ids de las sesiones de una cuenta (para contar cuántas revoca de verdad una operación de Better Auth). */
export function sessionIdsOf(db: Db, userId: string): string[] {
	return db
		.select({ id: session.id })
		.from(session)
		.where(eq(session.userId, userId))
		.all()
		.map((row) => row.id);
}

/** Cuántas de las sesiones de `before` ya no existen. */
export function revokedSince(db: Db, userId: string, before: readonly string[]): number {
	const remaining = new Set(sessionIdsOf(db, userId));
	return before.filter((id) => !remaining.has(id)).length;
}

export function closeOtherSession(
	deps: CloseSessionDeps,
	input: {
		readonly userId: string;
		readonly sessionId: string;
		readonly currentSessionId: string | null;
	}
): 'closed' | 'current' | 'not_found' {
	const { db } = deps;
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
	deps.logger.emit('accounts.session.revoked', { reason: 'user_closed_one', count: 1 });
	return 'closed';
}

/**
 * Cierra todas las sesiones de la cuenta menos la que hace la petición (UX-10). Devuelve cuántas cerró.
 * Sin sesión actual legible no cierra nada: no se puede garantizar que la persona siga dentro.
 */
export function closeOtherSessions(
	deps: CloseSessionDeps,
	input: { readonly userId: string; readonly currentSessionId: string | null }
): number {
	if (input.currentSessionId === null) return 0;
	const result = deps.db
		.delete(session)
		.where(and(eq(session.userId, input.userId), ne(session.id, input.currentSessionId)))
		.run();
	deps.logger.emit('accounts.session.revoked', {
		reason: 'user_closed_others',
		count: result.changes
	});
	return result.changes;
}
