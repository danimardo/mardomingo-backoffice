// Copia de los datos de una cuenta como predeterminados (BE-FR-42 CA3–CA4; T215). La vista previa lista por categoría los
// elementos seleccionables; la copia toma solo lo seleccionado. Las marcas de borrado no se copian: son artefactos de
// sincronización, no datos de un predeterminado.
import type { SyncSchema } from './schema-types';
import type { SyncData } from './document-types';

export interface PreviewCategory {
	readonly category: string;
	readonly elements: readonly string[];
}

export interface Selection {
	readonly category: string;
	readonly elements: readonly string[];
}

type Plain = Readonly<Record<string, unknown>>;
const isPlain = (value: unknown): value is Plain =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/** Elementos seleccionables de una categoría: claves de `items`, la categoría entera en `block`, claves en `keyed`. */
function elementsOf(category: SyncSchema['categories'][string], value: unknown): string[] {
	if (category.strategy === 'items' && isPlain(value) && Array.isArray(value.items)) {
		return value.items.flatMap((item) =>
			isPlain(item) && typeof item[category.key] === 'string' ? [item[category.key]] : []
		);
	}
	if (category.strategy === 'keyed' && isPlain(value)) return Object.keys(value);
	return [];
}

export function previewCopy(schema: SyncSchema, source: SyncData): PreviewCategory[] {
	return Object.entries(schema.categories)
		.filter(([name]) => Object.prototype.hasOwnProperty.call(source, name))
		.map(([name, category]) => {
			const value = source[name];
			const elements = category.strategy === 'block' ? [name] : elementsOf(category, value);
			return { category: name, elements };
		});
}

/** Solo las categorías con algún elemento seleccionado pasan al resultado, con solo esos elementos. */
export function applyCopy(
	schema: SyncSchema,
	source: SyncData,
	selection: readonly Selection[]
): SyncData {
	const result: Record<string, unknown> = {};
	for (const [name, category] of Object.entries(schema.categories)) {
		const chosen = selection.find((entry) => entry.category === name)?.elements ?? [];
		if (chosen.length === 0 || !Object.prototype.hasOwnProperty.call(source, name)) continue;
		const value = source[name];

		if (category.strategy === 'block') {
			if (chosen.includes(name)) result[name] = value;
		} else if (category.strategy === 'items' && isPlain(value) && Array.isArray(value.items)) {
			const items = value.items.filter(
				(item) => isPlain(item) && chosen.includes(String(item[category.key]))
			);
			if (items.length > 0) result[name] = { items, tombstones: [] };
		} else if (category.strategy === 'keyed' && isPlain(value)) {
			const picked = Object.fromEntries(
				Object.entries(value).filter(([key]) => chosen.includes(key))
			);
			if (Object.keys(picked).length > 0) result[name] = picked;
		}
	}
	return result;
}
