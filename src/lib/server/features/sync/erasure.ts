// Borrado y exportación de los documentos sincronizados de una cuenta (BE-FR-07 CA1, BE-FR-08; T283). Solo las llama
// `privacy`. Nunca se registra el contenido de un documento (Historias 15.19).
import { immediateTransaction } from '$lib/server/db/tx';
import { deleteDocumentsOfUser, documentsOfUser } from './repository';
import type { SyncDeps } from './service';

export interface SyncDocumentExport {
	readonly appId: string;
	readonly revision: number;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly data: unknown;
}

/** Documentos de la cuenta en todas las apps, tal como están guardados. */
export function exportDocuments(deps: Pick<SyncDeps, 'db'>, userId: string): SyncDocumentExport[] {
	return documentsOfUser(deps.db, userId).map((row) => ({
		appId: row.appId,
		revision: row.revision,
		createdAt: new Date(row.createdAt).toISOString(),
		updatedAt: new Date(row.updatedAt).toISOString(),
		data: row.data
	}));
}

/** Borra los documentos de la cuenta en todas las apps. Devuelve cuántos había. */
export function deleteAllForUser(deps: Pick<SyncDeps, 'db'>, userId: string): number {
	return immediateTransaction(deps.db, (tx) => deleteDocumentsOfUser(tx, userId));
}
