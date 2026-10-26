// Última actividad de la cuenta (T259; BE-FR-86). La anotan el acceso al panel y cada petición autenticada, web o de una app
// (login, uso de la API): sin ella, quien usa una app a diario sin abrir nunca el panel parecería inactivo. Solo escribe
// `user.last_activity_at`, y no más de una vez por hora para no convertir cada petición en una escritura.
import { eq } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import type { EpochMs } from '$lib/shared/time';
import { user } from './schema';

/** Tiempo mínimo entre dos anotaciones de la misma cuenta. */
export const ACTIVITY_GRANULARITY_MS = 60 * 60 * 1000;

export function touchActivity(db: Db, userId: string, now: EpochMs): void {
	const current = db
		.select({ lastActivityAt: user.lastActivityAt })
		.from(user)
		.where(eq(user.id, userId))
		.get();
	if (current === undefined) return;
	if (current.lastActivityAt !== null && now - current.lastActivityAt < ACTIVITY_GRANULARITY_MS) {
		return;
	}
	db.update(user).set({ lastActivityAt: now }).where(eq(user.id, userId)).run();
}
