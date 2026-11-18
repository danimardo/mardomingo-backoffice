// Resumen sin contenido de los predeterminados para la auditoría de W42 y W43 (BE-FR-55; C-41, decisión del propietario
// 2026-11-18). La auditoría es inmutable y los predeterminados pueden llevar datos personales copiados de una cuenta, así que
// no se guarda el JSON: solo las categorías, cuántos elementos tiene cada documento y un resumen criptográfico (que calcula el
// servicio sobre `canonicalJson`, porque el dominio no usa `node:crypto`). Con eso se ve qué cambió sin poder leerlo.
import type { SyncData } from './document-types';
import type { SyncSchema } from './schema-types';

type Plain = Readonly<Record<string, unknown>>;
const isPlain = (value: unknown): value is Plain =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/** JSON con las claves de cada objeto ordenadas: dos documentos iguales dan el mismo texto, y el mismo resumen. */
export function canonicalJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
	if (isPlain(value)) {
		const entries = Object.keys(value)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
		return `{${entries.join(',')}}`;
	}
	// `undefined` no tiene representación JSON (`JSON.stringify` devuelve `undefined`): cuenta como `null`.
	return value === undefined ? 'null' : JSON.stringify(value);
}

/**
 * Elementos de una categoría: los de `items` (sin las marcas de borrado), 1 por bloque y las claves de `keyed`. Una categoría
 * que el esquema vigente ya no declara cuenta como un elemento.
 */
function elementsOf(
	category: SyncSchema['categories'][string] | undefined,
	value: unknown
): number {
	if (category?.strategy === 'items') {
		return isPlain(value) && Array.isArray(value.items) ? value.items.length : 0;
	}
	if (category?.strategy === 'keyed') return isPlain(value) ? Object.keys(value).length : 0;
	return 1;
}

export interface DefaultsSummary {
	/** Categorías presentes, ordenadas. */
	readonly categories: readonly string[];
	/** Elementos en total, sumando todas las categorías. */
	readonly elements: number;
}

export function summarizeDefaults(schema: SyncSchema, data: SyncData): DefaultsSummary {
	const declared = schema.categories;
	const categories = Object.keys(data).sort();
	const elements = categories.reduce((total, name) => {
		const category = Object.prototype.hasOwnProperty.call(declared, name)
			? declared[name]
			: undefined;
		return total + elementsOf(category, data[name]);
	}, 0);
	return { categories, elements };
}

/** Categorías añadidas, quitadas o con otro valor entre dos documentos, ordenadas. */
export function changedCategories(before: SyncData, after: SyncData): string[] {
	const names = new Set([...Object.keys(before), ...Object.keys(after)]);
	return [...names]
		.filter((name) => {
			const inBefore = Object.prototype.hasOwnProperty.call(before, name);
			const inAfter = Object.prototype.hasOwnProperty.call(after, name);
			if (inBefore !== inAfter) return true;
			return canonicalJson(before[name]) !== canonicalJson(after[name]);
		})
		.sort();
}
