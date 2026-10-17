// Apps que la cuenta ha usado (T260; BE-FR-49.11, D-13). Solo lee `user_app_activity`: `accounts` no importa `sync`; las apps con
// documento sincronizado las une el llamador (la ruta) con `sync.syncedAppIds`.
import { eq } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import { userAppActivity } from './schema';

export function appsUsedBy(db: Db, userId: string): Set<string> {
	return new Set(
		db
			.select({ appId: userAppActivity.appId })
			.from(userAppActivity)
			.where(eq(userAppActivity.userId, userId))
			.all()
			.map((row) => row.appId)
	);
}
