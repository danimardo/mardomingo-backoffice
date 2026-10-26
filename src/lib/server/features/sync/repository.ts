// Acceso a `sync_documents` y `app_defaults` (BE-FR-39, BE-FR-41; T217). Todas las consultas filtran por `user_id` y
// `app_id`: un documento nunca se lee ni se escribe sin las dos claves.
import { and, eq } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import type { Tx } from '$lib/server/db/tx';
import type { EpochMs } from '$lib/shared/time';
import type { SyncData } from './domain/document-types';
import { appDefaults, syncDocuments } from './schema';

export interface StoredDocument {
	readonly revision: number;
	readonly data: unknown;
}

export function findDocument(
	db: Db | Tx,
	userId: string,
	appId: string
): StoredDocument | undefined {
	return db
		.select({ revision: syncDocuments.revision, data: syncDocuments.data })
		.from(syncDocuments)
		.where(and(eq(syncDocuments.userId, userId), eq(syncDocuments.appId, appId)))
		.get();
}

/** Todos los documentos de todas las cuentas y apps, para la limpieza diaria de marcas de borrado (H-27). */
export function allDocuments(db: Db | Tx): ReadonlyArray<{
	readonly userId: string;
	readonly appId: string;
	readonly revision: number;
	readonly data: unknown;
}> {
	return db
		.select({
			userId: syncDocuments.userId,
			appId: syncDocuments.appId,
			revision: syncDocuments.revision,
			data: syncDocuments.data
		})
		.from(syncDocuments)
		.all();
}

/** Todos los documentos de la cuenta, de cualquier app, por app (BE-FR-08). */
export function documentsOfUser(db: Db | Tx, userId: string) {
	return db
		.select()
		.from(syncDocuments)
		.where(eq(syncDocuments.userId, userId))
		.orderBy(syncDocuments.appId)
		.all();
}

/** Borra los documentos de la cuenta en todas las apps (BE-FR-07 CA1). Devuelve cuántos había. */
export function deleteDocumentsOfUser(tx: Tx, userId: string): number {
	return tx.delete(syncDocuments).where(eq(syncDocuments.userId, userId)).run().changes;
}

export function insertDocument(
	tx: Tx,
	row: {
		readonly userId: string;
		readonly appId: string;
		readonly data: SyncData;
		readonly now: EpochMs;
	}
): void {
	tx.insert(syncDocuments)
		.values({
			userId: row.userId,
			appId: row.appId,
			revision: 1,
			data: row.data,
			createdAt: row.now,
			updatedAt: row.now
		})
		.run();
}

/**
 * Sustituye el documento solo si su revisión sigue siendo la esperada: es lo que evita perder cambios entre dos clientes
 * (BE-FR-41). Devuelve si la fila cambió.
 */
export function replaceIfRevision(
	tx: Tx,
	row: {
		readonly userId: string;
		readonly appId: string;
		readonly expectedRevision: number;
		readonly data: SyncData;
		readonly now: EpochMs;
	}
): boolean {
	const result = tx
		.update(syncDocuments)
		.set({ revision: row.expectedRevision + 1, data: row.data, updatedAt: row.now })
		.where(
			and(
				eq(syncDocuments.userId, row.userId),
				eq(syncDocuments.appId, row.appId),
				eq(syncDocuments.revision, row.expectedRevision)
			)
		)
		.run();
	return result.changes === 1;
}

export function findDefaults(db: Db | Tx, appId: string): SyncData | undefined {
	return db
		.select({ data: appDefaults.data })
		.from(appDefaults)
		.where(eq(appDefaults.appId, appId))
		.get()?.data;
}

export function writeDefaults(tx: Tx, appId: string, data: SyncData, now: EpochMs): void {
	tx.insert(appDefaults)
		.values({ appId, data, updatedAt: now })
		.onConflictDoUpdate({ target: appDefaults.appId, set: { data, updatedAt: now } })
		.run();
}
