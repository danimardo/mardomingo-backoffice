// Validación del documento de sincronización por estrategia (BE-FR-39, BE-FR-41 CA2, FR-064, FR-066; T212). Puro: el esquema
// de la app y el tamaño máximo llegan por parámetro. Solo categorías declaradas, con la forma de su estrategia, y no más
// de `max_sync_doc_kb`.
import { describe, expect, it } from 'vitest';
import {
	documentBytes,
	invalidCategories,
	keepValidCategories,
	validateDocument
} from './document-schema';

const SCHEMA = {
	categories: {
		customReplacements: { strategy: 'items', key: 'from', tombstone_ttl_days: 30 },
		coreReplacements: { strategy: 'block' },
		preferences: { strategy: 'keyed', keys: ['language', 'autoCopy'] }
	}
} as const;

const MAX_BYTES = 1024 * 1024;

describe('validateDocument: categorías declaradas', () => {
	it('un documento válido con las categorías declaradas pasa', () => {
		expect(
			validateDocument(
				SCHEMA,
				{
					customReplacements: { items: [{ from: 'a', updatedAt: 1 }], tombstones: [] },
					coreReplacements: { value: { x: 1 }, updatedAt: 2 },
					preferences: { language: { value: 'es', updatedAt: 3 } }
				},
				MAX_BYTES
			)
		).toEqual({ ok: true });
	});

	it('una categoría no declarada se rechaza y se nombra', () => {
		expect(validateDocument(SCHEMA, { inventada: { value: 1, updatedAt: 1 } }, MAX_BYTES)).toEqual({
			ok: false,
			reason: 'undeclared_category',
			field: 'inventada'
		});
	});

	it('un documento que no es un objeto es malformado', () => {
		expect(validateDocument(SCHEMA, [], MAX_BYTES)).toEqual({
			ok: false,
			reason: 'malformed',
			field: 'data'
		});
	});
});

describe('validateDocument: forma de cada estrategia', () => {
	it('items: los elementos llevan su clave y updatedAt, sin claves repetidas', () => {
		const repeated = {
			customReplacements: {
				items: [
					{ from: 'a', updatedAt: 1 },
					{ from: 'a', updatedAt: 2 }
				],
				tombstones: []
			}
		};

		expect(validateDocument(SCHEMA, repeated, MAX_BYTES)).toMatchObject({
			ok: false,
			reason: 'malformed',
			field: 'customReplacements'
		});
	});

	it('items: un elemento sin updatedAt es malformado', () => {
		expect(
			validateDocument(
				SCHEMA,
				{ customReplacements: { items: [{ from: 'a' }], tombstones: [] } },
				MAX_BYTES
			)
		).toMatchObject({ ok: false, reason: 'malformed', field: 'customReplacements' });
	});

	it('items: las marcas de borrado llevan deletedAt', () => {
		expect(
			validateDocument(
				SCHEMA,
				{ customReplacements: { items: [], tombstones: [{ from: 'a' }] } },
				MAX_BYTES
			)
		).toMatchObject({ ok: false, reason: 'malformed', field: 'customReplacements' });
	});

	it('block: exige { value, updatedAt }', () => {
		expect(validateDocument(SCHEMA, { coreReplacements: { value: 1 } }, MAX_BYTES)).toMatchObject({
			ok: false,
			reason: 'malformed',
			field: 'coreReplacements'
		});
	});

	it('keyed: solo admite las claves declaradas, cada una con { value, updatedAt }', () => {
		expect(
			validateDocument(
				SCHEMA,
				{
					preferences: { language: { value: 'es', updatedAt: 1 }, otra: { value: 1, updatedAt: 1 } }
				},
				MAX_BYTES
			)
		).toMatchObject({ ok: false, reason: 'malformed', field: 'preferences' });
	});
});

describe('validateDocument: tamaño', () => {
	it('un documento mayor que el máximo se rechaza con too_large', () => {
		const big = 'x'.repeat(2048);

		expect(
			validateDocument(SCHEMA, { coreReplacements: { value: big, updatedAt: 1 } }, 1024)
		).toEqual({ ok: false, reason: 'too_large', field: 'data' });
	});

	it('exactamente en el máximo pasa', () => {
		const data = { coreReplacements: { value: 'x', updatedAt: 1 } };
		const bytes = new TextEncoder().encode(JSON.stringify(data)).byteLength;

		expect(validateDocument(SCHEMA, data, bytes)).toEqual({ ok: true });
	});
});

describe('validateDocument: formas que no son de su estrategia', () => {
	it('items sin lista de elementos es malformado', () => {
		expect(
			validateDocument(SCHEMA, { customReplacements: { items: 'x', tombstones: [] } }, MAX_BYTES)
		).toMatchObject({
			ok: false,
			reason: 'malformed',
			field: 'customReplacements'
		});
	});

	it('keyed con un valor que no es un objeto es malformado', () => {
		expect(validateDocument(SCHEMA, { preferences: ['es'] }, MAX_BYTES)).toMatchObject({
			ok: false,
			reason: 'malformed',
			field: 'preferences'
		});
	});
});

describe('categorías que el esquema vigente ya no admite (C-45)', () => {
	// Predeterminados guardados antes de que W40 quitara `retirada` y pasara `preferences` de keyed a block.
	const STALE = {
		coreReplacements: { value: { x: 1 }, updatedAt: 2 },
		retirada: { value: 'ya no declarada', updatedAt: 1 },
		preferences: { idioma: { value: 'es', updatedAt: 3 } }
	};

	it('invalidCategories nombra las no declaradas y las de otra forma, en el orden del documento', () => {
		expect(invalidCategories(SCHEMA, STALE)).toEqual(['retirada', 'preferences']);
	});

	it('invalidCategories de un documento válido o vacío no nombra ninguna', () => {
		expect(invalidCategories(SCHEMA, { coreReplacements: STALE.coreReplacements })).toEqual([]);
		expect(invalidCategories(SCHEMA, {})).toEqual([]);
	});

	it('keepValidCategories deja solo las categorías admitidas, enteras, y el resultado valida', () => {
		const kept = keepValidCategories(SCHEMA, STALE);

		expect(kept).toEqual({ coreReplacements: STALE.coreReplacements });
		expect(validateDocument(SCHEMA, kept, MAX_BYTES)).toEqual({ ok: true });
	});

	it('documentBytes mide el JSON en bytes UTF-8', () => {
		expect(documentBytes({ a: 'ñ' })).toBe('{"a":"ñ"}'.length + 1);
	});
});
