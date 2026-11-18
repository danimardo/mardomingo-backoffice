// Resumen sin contenido de los predeterminados para la auditoría (BE-FR-55; C-41, T433): categorías, número de elementos,
// JSON canónico para el resumen criptográfico y categorías cambiadas. Nunca el contenido.
import { describe, expect, it } from 'vitest';
import { canonicalJson, changedCategories, summarizeDefaults } from './defaults-summary';

const SCHEMA = {
	categories: {
		customReplacements: { strategy: 'items', key: 'from', tombstone_ttl_days: 30 },
		coreReplacements: { strategy: 'block' },
		preferences: { strategy: 'keyed' }
	}
} as const;

describe('canonicalJson', () => {
	it('ordena las claves de cada objeto, también anidadas, y respeta el orden de los arrays', () => {
		expect(canonicalJson({ b: 1, a: { d: [2, { z: 1, y: 0 }], c: 'x' } })).toBe(
			'{"a":{"c":"x","d":[2,{"y":0,"z":1}]},"b":1}'
		);
	});

	it('dos documentos con las claves en otro orden dan el mismo texto', () => {
		expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
	});

	it('los valores sin representación JSON quedan como null', () => {
		expect(canonicalJson(undefined)).toBe('null');
		expect(canonicalJson(null)).toBe('null');
	});
});

describe('summarizeDefaults', () => {
	it('cuenta los elementos de items (sin marcas de borrado), 1 por bloque y las claves de keyed', () => {
		expect(
			summarizeDefaults(SCHEMA, {
				preferences: {
					language: { value: 'es', updatedAt: 0 },
					autoCopy: { value: 1, updatedAt: 0 }
				},
				customReplacements: {
					items: [
						{ from: 'a', updatedAt: 0 },
						{ from: 'b', updatedAt: 0 }
					],
					tombstones: [{ from: 'c', deletedAt: 0 }]
				},
				coreReplacements: { value: ['dato personal'], updatedAt: 0 }
			})
		).toEqual({
			categories: ['coreReplacements', 'customReplacements', 'preferences'],
			elements: 5
		});
	});

	it('una categoría no declarada cuenta como un elemento y una con otra forma, como ninguno', () => {
		expect(
			summarizeDefaults(SCHEMA, {
				retirada: { value: 1, updatedAt: 0 },
				customReplacements: { value: 1, updatedAt: 0 },
				preferences: ['no es un objeto']
			})
		).toEqual({ categories: ['customReplacements', 'preferences', 'retirada'], elements: 1 });
	});

	it('el resumen no contiene ningún valor del documento', () => {
		const summary = summarizeDefaults(SCHEMA, {
			coreReplacements: { value: ['dato personal'], updatedAt: 0 }
		});

		expect(JSON.stringify(summary)).not.toContain('dato personal');
	});
});

describe('changedCategories', () => {
	it('nombra las categorías añadidas, quitadas y cambiadas, ordenadas, y no las iguales', () => {
		expect(
			changedCategories(
				{ quitada: 1, igual: { a: 1, b: 2 }, cambiada: { value: 'antes' } },
				{ igual: { b: 2, a: 1 }, cambiada: { value: 'después' }, nueva: 1 }
			)
		).toEqual(['cambiada', 'nueva', 'quitada']);
	});

	it('entre dos documentos iguales no hay cambios', () => {
		expect(changedCategories({ a: 1 }, { a: 1 })).toEqual([]);
	});
});
