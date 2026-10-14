// Última actividad de la cuenta (T259; BE-FR-86). Lo llama el layout del panel al entrar; solo escribe `user.last_activity_at`.
import { eq } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import type { EpochMs } from '$lib/shared/time';
import { user } from './schema';

export function touchActivity(db: Db, userId: string, now: EpochMs): void {
	db.update(user).set({ lastActivityAt: now }).where(eq(user.id, userId)).run();
}
