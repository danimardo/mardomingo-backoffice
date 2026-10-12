// Validación del documento de sincronización por estrategia (BE-FR-39, BE-FR-41 CA2, FR-064, FR-066; T212, T215). Puro: el
// esquema de la app y el tamaño máximo llegan por parámetro. La fusión la hace el cliente; el servidor solo comprueba que
// el documento contiene categorías declaradas, con la forma de su estrategia, y que no supera el tamaño permitido.
import type { SyncSchema } from './schema-types';

export type DocumentVerdict =
	| { readonly ok: true }
	| {
			readonly ok: false;
			readonly reason: 'undeclared_category' | 'malformed' | 'too_large';
			readonly field: string;
	  };

type Plain = Readonly<Record<string, unknown>>;

function isPlain(value: unknown): value is Plain {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStamp(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** Un bloque `{ value, updatedAt }` (estrategias `block` y `keyed`). */
function isStamped(value: unknown): boolean {
	return isPlain(value) && 'value' in value && isStamp(value.updatedAt);
}

/** Los elementos de `items` llevan su clave (única) y `updatedAt`; las marcas de borrado, la clave y `deletedAt`. */
function isItemList(value: unknown, key: string, stamp: 'updatedAt' | 'deletedAt'): boolean {
	if (!Array.isArray(value)) return false;
	const seen = new Set<unknown>();
	for (const entry of value) {
		if (!isPlain(entry) || !(key in entry) || !isStamp(entry[stamp])) return false;
		const id = entry[key];
		if (typeof id !== 'string' || seen.has(id)) return false;
		seen.add(id);
	}
	return true;
}

function isItemsCategory(value: unknown, key: string): boolean {
	return (
		isPlain(value) &&
		isItemList(value.items, key, 'updatedAt') &&
		isItemList(value.tombstones, key, 'deletedAt')
	);
}

function isKeyedCategory(value: unknown, keys: readonly string[] | undefined): boolean {
	if (!isPlain(value)) return false;
	return Object.entries(value).every(
		([name, block]) => (keys === undefined || keys.includes(name)) && isStamped(block)
	);
}

/** Forma de una categoría según su estrategia en el esquema de la app. */
function isCategoryOf(category: SyncSchema['categories'][string], value: unknown): boolean {
	switch (category.strategy) {
		case 'items':
			return isItemsCategory(value, category.key);
		case 'block':
			return isStamped(value);
		case 'keyed':
			return isKeyedCategory(value, category.keys);
	}
}

/**
 * Comprueba el documento contra el esquema de la app: solo categorías declaradas, con la forma de su estrategia, y no más
 * de `maxBytes` en JSON. Devuelve la primera categoría que falla, para que el error pueda nombrarla.
 */
export function validateDocument(
	schema: SyncSchema,
	data: unknown,
	maxBytes: number
): DocumentVerdict {
	if (!isPlain(data)) return { ok: false, reason: 'malformed', field: 'data' };
	const declared = schema.categories;

	for (const [name, value] of Object.entries(data)) {
		const category = Object.prototype.hasOwnProperty.call(declared, name)
			? declared[name]
			: undefined;
		if (category === undefined) return { ok: false, reason: 'undeclared_category', field: name };
		if (!isCategoryOf(category, value)) return { ok: false, reason: 'malformed', field: name };
	}

	const bytes = new TextEncoder().encode(JSON.stringify(data)).byteLength;
	if (bytes > maxBytes) return { ok: false, reason: 'too_large', field: 'data' };
	return { ok: true };
}
