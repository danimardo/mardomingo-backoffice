// Poda de marcas de borrado de un documento de sincronización (FR-064, H-27; T338). Puro: el esquema de la app, la hora y el
// documento llegan por parámetro. Solo toca las categorías `items`: cada una fija su `tombstone_ttl_days`, y una marca cuyo
// `deletedAt` es anterior al corte se elimina. El resto del documento no cambia.
import type { SyncSchema } from './schema-types';
import type { SyncData } from './document-types';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PruneResult {
	readonly data: SyncData;
	/** Cuántas marcas se han eliminado. Cero significa que el documento no cambia. */
	readonly removed: number;
}

function isPlain(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function pruneTombstones(schema: SyncSchema, data: SyncData, nowMs: number): PruneResult {
	let removed = 0;
	const result: Record<string, unknown> = { ...data };
	for (const [name, value] of Object.entries(data)) {
		const category = Object.prototype.hasOwnProperty.call(schema.categories, name)
			? schema.categories[name]
			: undefined;
		if (category?.strategy !== 'items' || !isPlain(value) || !Array.isArray(value.tombstones)) {
			continue;
		}
		const cutoff = nowMs - category.tombstone_ttl_days * DAY_MS;
		const kept = value.tombstones.filter(
			(entry: unknown) =>
				!(isPlain(entry) && typeof entry.deletedAt === 'number' && entry.deletedAt < cutoff)
		);
		const dropped = value.tombstones.length - kept.length;
		if (dropped > 0) {
			removed += dropped;
			result[name] = { ...value, tombstones: kept };
		}
	}
	return { data: result, removed };
}
