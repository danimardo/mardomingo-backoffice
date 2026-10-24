// Poda de marcas de borrado (FR-064, H-27; T338): solo caduca las marcas anteriores al corte de su categoría, y no toca
// nada más del documento.
import { describe, expect, it } from 'vitest';
import type { SyncSchema } from './schema-types';
import { pruneTombstones } from './tombstones';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 24);
const SCHEMA: SyncSchema = {
	categories: {
		customReplacements: { strategy: 'items', key: 'from', tombstone_ttl_days: 30 },
		fontSize: { strategy: 'block' }
	}
};

describe('poda de marcas de borrado (T338)', () => {
	it('elimina las marcas anteriores al corte y conserva las recientes', () => {
		const data = {
			customReplacements: {
				items: [{ from: 'hola', updatedAt: 1 }],
				tombstones: [
					{ from: 'viejo', deletedAt: NOW - 31 * DAY_MS },
					{ from: 'reciente', deletedAt: NOW - 29 * DAY_MS }
				]
			}
		};

		const pruned = pruneTombstones(SCHEMA, data, NOW);

		expect(pruned.removed).toBe(1);
		expect(pruned.data).toStrictEqual({
			customReplacements: {
				items: [{ from: 'hola', updatedAt: 1 }],
				tombstones: [{ from: 'reciente', deletedAt: NOW - 29 * DAY_MS }]
			}
		});
	});

	it('una marca justo en el corte se conserva', () => {
		const data = {
			customReplacements: {
				items: [],
				tombstones: [{ from: 'justo', deletedAt: NOW - 30 * DAY_MS }]
			}
		};

		expect(pruneTombstones(SCHEMA, data, NOW).removed).toBe(0);
	});

	it('sin marcas caducadas el documento se devuelve sin cambios', () => {
		const data = { fontSize: { value: 'm', updatedAt: 5 } };

		const pruned = pruneTombstones(SCHEMA, data, NOW);

		expect(pruned.removed).toBe(0);
		expect(pruned.data).toStrictEqual(data);
	});

	it('ignora lo que no es una categoría declarada con marcas bien formadas', () => {
		const data = {
			undeclared: { tombstones: [{ deletedAt: 1 }] },
			customReplacements: 'no es un objeto',
			noTombstones: undefined
		};
		const items = { customReplacements: { items: [], tombstones: 'no es lista' } };
		const malformed = {
			customReplacements: {
				items: [],
				tombstones: ['texto', { from: 'sin fecha' }, { from: 'fecha no numérica', deletedAt: 'x' }]
			}
		};

		expect(pruneTombstones(SCHEMA, data, NOW).removed).toBe(0);
		expect(pruneTombstones(SCHEMA, items, NOW).removed).toBe(0);
		const pruned = pruneTombstones(SCHEMA, malformed, NOW);
		expect(pruned.removed).toBe(0);
		expect(pruned.data).toStrictEqual(malformed);
	});

	it('las categorías que no son de elementos no se tocan aunque tengan marcas con fecha antigua', () => {
		const data = { fontSize: { value: 'm', updatedAt: 5, tombstones: [{ deletedAt: 1 }] } };

		expect(pruneTombstones(SCHEMA, data, NOW).removed).toBe(0);
	});
});
