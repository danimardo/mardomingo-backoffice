// Copia de los datos de una cuenta como predeterminados (BE-FR-42 CA3–CA4; T213): vista previa por categorías y elementos,
// y copia solo de lo seleccionado. Una categoría sin ningún elemento seleccionado no se sustituye.
import { describe, expect, it } from 'vitest';
import { applyCopy, previewCopy } from './copy-defaults';
import type { SyncSchema } from './schema-types';

const SCHEMA: SyncSchema = {
	categories: {
		customReplacements: { strategy: 'items', key: 'from', tombstone_ttl_days: 30 },
		coreReplacements: { strategy: 'block' },
		preferences: { strategy: 'keyed', keys: ['language', 'autoCopy'] }
	}
};

const SOURCE = {
	customReplacements: {
		items: [
			{ from: 'hola', updatedAt: 1, text: 'buenas' },
			{ from: 'datos-personales', updatedAt: 2, text: 'DNI 123' }
		],
		tombstones: [{ from: 'viejo', deletedAt: 3 }]
	},
	coreReplacements: { value: [{ a: 1 }], updatedAt: 4 },
	preferences: {
		language: { value: 'es', updatedAt: 5 },
		autoCopy: { value: true, updatedAt: 6 }
	}
};

describe('previewCopy', () => {
	it('lista cada categoría con sus elementos seleccionables', () => {
		expect(previewCopy(SCHEMA, SOURCE)).toEqual([
			{
				category: 'customReplacements',
				elements: ['hola', 'datos-personales']
			},
			{ category: 'coreReplacements', elements: ['coreReplacements'] },
			{ category: 'preferences', elements: ['language', 'autoCopy'] }
		]);
	});
});

describe('applyCopy', () => {
	it('copia solo los elementos seleccionados y deja fuera los datos excluidos', () => {
		const result = applyCopy(SCHEMA, SOURCE, [
			{ category: 'customReplacements', elements: ['hola'] }
		]);

		expect(result).toEqual({
			customReplacements: {
				items: [{ from: 'hola', updatedAt: 1, text: 'buenas' }],
				tombstones: []
			}
		});
	});

	it('una categoría sin ningún elemento seleccionado no aparece en el resultado', () => {
		const result = applyCopy(SCHEMA, SOURCE, [{ category: 'preferences', elements: [] }]);

		expect(result).toEqual({});
	});

	it('un bloque se copia entero si está seleccionado', () => {
		const result = applyCopy(SCHEMA, SOURCE, [
			{ category: 'coreReplacements', elements: ['coreReplacements'] }
		]);

		expect(result).toEqual({ coreReplacements: { value: [{ a: 1 }], updatedAt: 4 } });
	});

	it('de keyed solo se copian las claves seleccionadas', () => {
		const result = applyCopy(SCHEMA, SOURCE, [{ category: 'preferences', elements: ['autoCopy'] }]);

		expect(result).toEqual({ preferences: { autoCopy: { value: true, updatedAt: 6 } } });
	});

	it('no modifica el documento de origen', () => {
		applyCopy(SCHEMA, SOURCE, [{ category: 'customReplacements', elements: ['hola'] }]);

		expect(SOURCE.customReplacements.items).toHaveLength(2);
	});
});
