// Siembra del documento de una cuenta (BE-FR-40; T215): los predeterminados vigentes con todas las fechas a cero y
// revisión 1. Así, en la primera sincronización, cualquier dato local con fecha real del usuario gana.
import type { SyncData } from './document-types';

export interface SeededDocument {
	readonly revision: number;
	readonly data: SyncData;
}

/** Sustituye por 0 cualquier `updatedAt` o `deletedAt` del árbol, sin tocar el original. */
function zeroValue(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(zeroValue);
	if (typeof value !== 'object' || value === null) return value;
	return Object.fromEntries(
		Object.entries(value).map(([key, inner]) =>
			key === 'updatedAt' || key === 'deletedAt' ? [key, 0] : [key, zeroValue(inner)]
		)
	);
}

export function seedDocumentFrom(defaults: SyncData): SeededDocument {
	return {
		revision: 1,
		data: Object.fromEntries(
			Object.entries(defaults).map(([name, value]) => [name, zeroValue(value)])
		)
	};
}
