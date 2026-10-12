// Propiedades del validador de documentos de sincronización (T214; Historias 15.8): acepta todo documento válido generado
// desde un esquema arbitrario y rechaza cualquier categoría que el esquema no declara.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { SyncCategory, SyncSchema } from './schema-types';
import { validateDocument } from './document-schema';

const NAME = fc.stringMatching(/^[a-z][a-zA-Z0-9]{0,8}$/);

/** Un esquema con categorías de las tres estrategias, con nombres distintos. */
const schemaArb: fc.Arbitrary<{ schema: SyncSchema; names: string[] }> = fc
	.uniqueArray(NAME, { minLength: 1, maxLength: 4 })
	.chain((names) =>
		fc.tuple(...names.map(() => fc.constantFrom('items', 'block', 'keyed'))).map((strategies) => {
			const categories: Record<string, SyncCategory> = {};
			names.forEach((name, index) => {
				const strategy = strategies[index];
				categories[name] =
					strategy === 'items'
						? { strategy: 'items', key: 'id', tombstone_ttl_days: 30 }
						: strategy === 'keyed'
							? { strategy: 'keyed', keys: ['a', 'b'] }
							: { strategy: 'block' };
			});
			return { schema: { categories }, names };
		})
	);

/** Un valor válido para la estrategia de la categoría. */
function validValueOf(category: SyncSchema['categories'][string]): unknown {
	if (category.strategy === 'items') {
		return { items: [{ id: 'x', updatedAt: 1 }], tombstones: [{ id: 'y', deletedAt: 2 }] };
	}
	if (category.strategy === 'keyed') {
		return { a: { value: 1, updatedAt: 1 } };
	}
	return { value: 'texto', updatedAt: 1 };
}

describe('validateDocument: propiedades', () => {
	it('acepta todo documento válido generado desde un esquema arbitrario', () => {
		fc.assert(
			fc.property(schemaArb, ({ schema }) => {
				const data: Record<string, unknown> = {};
				for (const [name, category] of Object.entries(schema.categories)) {
					data[name] = validValueOf(category);
				}
				expect(validateDocument(schema, data, 1_000_000)).toEqual({ ok: true });
			})
		);
	});

	it('rechaza cualquier categoría que el esquema no declara, con su nombre', () => {
		fc.assert(
			fc.property(schemaArb, NAME, ({ schema }, extra) => {
				fc.pre(!Object.prototype.hasOwnProperty.call(schema.categories, extra));
				const data: Record<string, unknown> = { [extra]: { value: 1, updatedAt: 1 } };
				expect(validateDocument(schema, data, 1_000_000)).toEqual({
					ok: false,
					reason: 'undeclared_category',
					field: extra
				});
			})
		);
	});
});
