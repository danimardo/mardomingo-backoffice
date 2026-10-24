// Email de la cuenta para los avisos de otras funcionalidades (T254). Solo lee `user`: `accounts` es la única dueña de ese email.
import { eq } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import { user } from './schema';

/** App desde la que se creó la cuenta (BE-FR-64 CA2), o `null` si no hay ninguna. */
export function signupAppIdOf(db: Db, userId: string): string | null {
	return (
		db.select({ appId: user.signupAppId }).from(user).where(eq(user.id, userId)).get()?.appId ??
		null
	);
}

export function emailOfUser(db: Db, userId: string): string | null {
	return (
		db.select({ email: user.email }).from(user).where(eq(user.id, userId)).get()?.email ?? null
	);
}
