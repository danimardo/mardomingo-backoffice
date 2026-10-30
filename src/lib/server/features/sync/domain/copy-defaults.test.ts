// Copia de los datos de una cuenta como predeterminados (BE-FR-42 CA3–CA4; T213): vista previa por categorías y elementos,
// y copia solo de lo seleccionado. Una categoría sin ningún elemento seleccionado no se sustituye.
import { describe, expect, it } from 'vitest';
import { applyCopy, previewCopy } from './copy-defaults';
import type { SyncSchema } from './schema-types';

const SCHEMA: SyncSchema = {
	categories: {
		customReplacements: { strategy: 'items', key: 'from', tombstone_ttl_days: 30 },
		coreReplacements: { strategy: 'block' },
		prompts: { strategy: 'block', personal: true },
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
	prompts: { value: ['resume mis correos'], updatedAt: 7 },
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
				elements: ['hola', 'datos-personales'],
				personal: false
			},
			{ category: 'coreReplacements', elements: ['coreReplacements'], personal: false },
			{ category: 'prompts', elements: ['prompts'], personal: true },
			{ category: 'preferences', elements: ['language', 'autoCopy'], personal: false }
		]);
	});

	it('marca como personales solo las categorías con `personal: true` en el esquema (D14)', () => {
		const personal = previewCopy(SCHEMA, SOURCE)
			.filter((category) => category.personal)
			.map((category) => category.category);

		expect(personal).toEqual(['prompts']);
	});

	it('no preselecciona nada: la vista previa solo describe, la copia exige marcar (D14)', () => {
		const result = applyCopy(SCHEMA, SOURCE, []);

		expect(result).toEqual({});
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

describe('casos de borde de la copia', () => {
	it('la vista previa ignora entradas que no son objetos o no tienen clave de texto', () => {
		const messy = {
			customReplacements: {
				items: ['texto suelto', { from: 5 }, { from: 'a', updatedAt: 1 }],
				tombstones: []
			}
		};

		expect(previewCopy(SCHEMA, messy)).toEqual([
			{ category: 'customReplacements', elements: ['a'], personal: false }
		]);
	});

	it('una categoría items con valor que no es un objeto no ofrece elementos', () => {
		expect(previewCopy(SCHEMA, { customReplacements: [1, 2] })).toEqual([
			{ category: 'customReplacements', elements: [], personal: false }
		]);
	});

	it('un bloque no se copia si la selección no lo incluye', () => {
		expect(
			applyCopy(SCHEMA, SOURCE, [{ category: 'coreReplacements', elements: ['otro'] }])
		).toEqual({});
	});

	it('una selección de elementos inexistentes no copia nada de items', () => {
		expect(
			applyCopy(SCHEMA, SOURCE, [{ category: 'customReplacements', elements: ['nadie'] }])
		).toEqual({});
	});

	it('una categoría items cuyo valor no tiene la forma de items no se copia', () => {
		expect(
			applyCopy(SCHEMA, { customReplacements: [1] }, [
				{ category: 'customReplacements', elements: ['hola'] }
			])
		).toEqual({});
		expect(
			applyCopy(SCHEMA, { customReplacements: { items: 'x' } }, [
				{ category: 'customReplacements', elements: ['hola'] }
			])
		).toEqual({});
	});

	it('una categoría keyed cuyo valor no es un objeto no se copia', () => {
		expect(
			applyCopy(SCHEMA, { preferences: ['es'] }, [
				{ category: 'preferences', elements: ['language'] }
			])
		).toEqual({});
	});

	it('una selección de claves keyed inexistentes no copia nada', () => {
		expect(applyCopy(SCHEMA, SOURCE, [{ category: 'preferences', elements: ['otra'] }])).toEqual(
			{}
		);
	});
});
