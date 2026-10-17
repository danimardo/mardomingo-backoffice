// Email de la cuenta para los avisos de otras funcionalidades (T254). Solo lee `user`: `accounts` es la única dueña de ese email.
import { eq } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import { user } from './schema';

export function emailOfUser(db: Db, userId: string): string | null {
	return (
		db.select({ email: user.email }).from(user).where(eq(user.id, userId)).get()?.email ?? null
	);
}
