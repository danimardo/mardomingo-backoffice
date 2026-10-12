// Siembra del documento de una cuenta (BE-FR-40; T213): copia los predeterminados vigentes con todas las fechas a cero y
// revisión 1, de modo que en la primera sincronización lo local con fecha real gana.
import { describe, expect, it } from 'vitest';
import { seedDocumentFrom } from './seed';

const DEFAULTS = {
	customReplacements: {
		items: [{ from: 'hola', updatedAt: 7, text: 'buenas' }],
		tombstones: [{ from: 'adiós', deletedAt: 9 }]
	},
	coreReplacements: { value: [{ a: 1 }], updatedAt: 5 },
	preferences: { language: { value: 'es', updatedAt: 3 } }
};

describe('seedDocumentFrom', () => {
	it('copia los predeterminados con todos los updatedAt y deletedAt a cero', () => {
		const seeded = seedDocumentFrom(DEFAULTS);

		expect(seeded.data).toEqual({
			customReplacements: {
				items: [{ from: 'hola', updatedAt: 0, text: 'buenas' }],
				tombstones: [{ from: 'adiós', deletedAt: 0 }]
			},
			coreReplacements: { value: [{ a: 1 }], updatedAt: 0 },
			preferences: { language: { value: 'es', updatedAt: 0 } }
		});
	});

	it('la revisión inicial es 1', () => {
		expect(seedDocumentFrom(DEFAULTS).revision).toBe(1);
	});

	it('no modifica los predeterminados de origen', () => {
		seedDocumentFrom(DEFAULTS);

		expect(DEFAULTS.coreReplacements.updatedAt).toBe(5);
	});

	it('con predeterminados vacíos, el documento sembrado también está vacío', () => {
		expect(seedDocumentFrom({})).toEqual({ revision: 1, data: {} });
	});
});
