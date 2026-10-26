// Cierre de una sesión desde W26 (T264; BE-FR-49.2). Nunca cierra la sesión que usa la persona (`current`) ni una de otra
// cuenta (`not_found`). Solo toca la tabla `session` de `accounts`.
import { and, eq, ne } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import { session } from './schema';

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

/**
 * Cierra todas las sesiones de la cuenta menos la que hace la petición (UX-10). Devuelve cuántas cerró.
 * Sin sesión actual legible no cierra nada: no se puede garantizar que la persona siga dentro.
 */
export function closeOtherSessions(
	db: Db,
	input: { readonly userId: string; readonly currentSessionId: string | null }
): number {
	if (input.currentSessionId === null) return 0;
	const result = db
		.delete(session)
		.where(and(eq(session.userId, input.userId), ne(session.id, input.currentSessionId)))
		.run();
	return result.changes;
}
