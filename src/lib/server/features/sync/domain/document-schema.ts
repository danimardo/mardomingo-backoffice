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

/** Por qué el esquema no admite una categoría, o `null` si la admite. */
function categoryProblem(
	schema: SyncSchema,
	name: string,
	value: unknown
): 'undeclared_category' | 'malformed' | null {
	const declared = schema.categories;
	const category = Object.prototype.hasOwnProperty.call(declared, name)
		? declared[name]
		: undefined;
	if (category === undefined) return 'undeclared_category';
	return isCategoryOf(category, value) ? null : 'malformed';
}

/** Tamaño del documento serializado en JSON, en bytes UTF-8. */
export function documentBytes(data: unknown): number {
	return new TextEncoder().encode(JSON.stringify(data)).byteLength;
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

	for (const [name, value] of Object.entries(data)) {
		const problem = categoryProblem(schema, name, value);
		if (problem !== null) return { ok: false, reason: problem, field: name };
	}

	if (documentBytes(data) > maxBytes) return { ok: false, reason: 'too_large', field: 'data' };
	return { ok: true };
}

/**
 * Categorías de un documento que el esquema vigente no admite: no declaradas o con la forma de otra estrategia (C-45).
 * Pasa con los predeterminados guardados antes de un cambio del esquema en W40: `apps` no puede revalidarlos.
 */
export function invalidCategories(
	schema: SyncSchema,
	data: Readonly<Record<string, unknown>>
): string[] {
	return Object.entries(data)
		.filter(([name, value]) => categoryProblem(schema, name, value) !== null)
		.map(([name]) => name);
}

/** El documento con solo las categorías que el esquema vigente admite, enteras (la siembra, BE-FR-40; C-45). */
export function keepValidCategories(
	schema: SyncSchema,
	data: Readonly<Record<string, unknown>>
): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(data).filter(([name, value]) => categoryProblem(schema, name, value) === null)
	);
}
