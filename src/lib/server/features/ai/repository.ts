// Repositorio de `ai` (BE-FR-81, D-12, principio I; T165). Solo toca `ai_operations` y `model_cache`, y filtra por usuario
// y app. Las escrituras de cobro van dentro de las transacciones que abre el servicio (`BEGIN IMMEDIATE`, sin `await`).
import { and, count, desc, eq, gte, inArray } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import type { Tx } from '$lib/server/db/tx';
import type { EpochMs } from '$lib/shared/time';
import { AppError } from '$lib/server/shared/errors';
import { aiOperations, modelCache, type ModelPricingJson } from './schema';

export type OperationRecord = typeof aiOperations.$inferSelect;
export type OperationInsert = typeof aiOperations.$inferInsert;
export type OperationPatch = Partial<Omit<OperationInsert, 'id' | 'userId' | 'createdAt'>>;

/** Última operación de la misma clave del usuario dentro de la ventana (BE-FR-81 CA1). */
export function lastOperationByKey(
	db: Db,
	input: { readonly userId: string; readonly key: string; readonly since: EpochMs }
): OperationRecord | undefined {
	return db
		.select()
		.from(aiOperations)
		.where(
			and(
				eq(aiOperations.userId, input.userId),
				eq(aiOperations.idempotencyKey, input.key),
				gte(aiOperations.createdAt, input.since)
			)
		)
		.orderBy(desc(aiOperations.createdAt))
		.limit(1)
		.get();
}

/**
 * Alta de una operación. Si ya hay otra en curso con la misma clave, el índice único parcial lo rechaza: se traduce a
 * `REQUEST_IN_PROGRESS` (dos peticiones simultáneas con la misma clave, una sola ejecución).
 */
export function insertOperation(tx: Tx, row: OperationInsert): void {
	try {
		tx.insert(aiOperations).values(row).run();
	} catch (error) {
		if (error instanceof Error && error.message.includes('ai_operations.user_id')) {
			throw new AppError('REQUEST_IN_PROGRESS');
		}
		throw error;
	}
}

export function updateOperation(tx: Tx, id: string, patch: OperationPatch): void {
	tx.update(aiOperations).set(patch).where(eq(aiOperations.id, id)).run();
}

export function readOperation(db: Db, id: string): OperationRecord | undefined {
	return db.select().from(aiOperations).where(eq(aiOperations.id, id)).get();
}

/** Operaciones marcadas por moderación del usuario desde `since` (el día de Madrid, FR-061). */
export function countFlaggedSince(db: Db, userId: string, since: EpochMs): number {
	return (
		db
			.select({ total: count() })
			.from(aiOperations)
			.where(
				and(
					eq(aiOperations.userId, userId),
					eq(aiOperations.flagged, true),
					gte(aiOperations.createdAt, since)
				)
			)
			.get()?.total ?? 0
	);
}

/** Pasa a `interrupted` las operaciones en curso al arrancar (FR-028, BE-FR-71). Devuelve cuántas eran. */
export function interruptInProgress(tx: Tx, now: EpochMs): number {
	const rows = tx
		.select({ id: aiOperations.id })
		.from(aiOperations)
		.where(eq(aiOperations.status, 'in_progress'))
		.all();
	if (rows.length === 0) return 0;
	tx.update(aiOperations)
		.set({ status: 'interrupted', completedAt: now })
		.where(
			inArray(
				aiOperations.id,
				rows.map((row) => row.id)
			)
		)
		.run();
	return rows.length;
}

export interface ModelCacheRow {
	readonly modelId: string;
	readonly pricing: ModelPricingJson;
	readonly modalities: readonly string[];
	readonly supportedParameters: readonly string[];
	readonly fetchedAt: EpochMs;
}

/** Precios de los modelos conocidos; los que no están en la caché no aparecen. */
export function pricesOf(db: Db, modelIds: readonly string[]): Map<string, ModelPricingJson> {
	if (modelIds.length === 0) return new Map();
	const rows = db
		.select({ modelId: modelCache.modelId, pricing: modelCache.pricing })
		.from(modelCache)
		.where(inArray(modelCache.modelId, [...modelIds]))
		.all();
	return new Map(rows.map((row) => [row.modelId, row.pricing]));
}

export function readModelCache(db: Db): ModelCacheRow[] {
	return db
		.select()
		.from(modelCache)
		.orderBy(modelCache.modelId)
		.all()
		.map((row) => ({
			modelId: row.modelId,
			pricing: row.pricing,
			modalities: row.modalities,
			supportedParameters: row.supportedParameters,
			fetchedAt: row.fetchedAt
		}));
}

/** Sustituye la caché del catálogo por la última lectura del proveedor. */
export function replaceModelCache(
	tx: Tx,
	rows: readonly Omit<ModelCacheRow, 'fetchedAt'>[],
	fetchedAt: EpochMs
): void {
	tx.delete(modelCache).run();
	for (const row of rows) {
		tx.insert(modelCache)
			.values({
				modelId: row.modelId,
				pricing: row.pricing,
				modalities: [...row.modalities],
				supportedParameters: [...row.supportedParameters],
				fetchedAt
			})
			.run();
	}
}

/** Operaciones en curso (para el arranque y para el contador de pruebas). */
export function countInProgress(db: Db): number {
	return (
		db
			.select({ total: count() })
			.from(aiOperations)
			.where(eq(aiOperations.status, 'in_progress'))
			.get()?.total ?? 0
	);
}
