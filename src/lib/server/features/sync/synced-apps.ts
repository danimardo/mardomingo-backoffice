// Apps con documento sincronizado de una cuenta (T260; BE-FR-85/CA1). Solo lee `sync_documents`, la tabla de `sync`.
import { eq } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import { syncDocuments } from './schema';

export function syncedAppIds(db: Db, userId: string): Set<string> {
	return new Set(
		db
			.select({ appId: syncDocuments.appId })
			.from(syncDocuments)
			.where(eq(syncDocuments.userId, userId))
			.all()
			.map((row) => row.appId)
	);
}
