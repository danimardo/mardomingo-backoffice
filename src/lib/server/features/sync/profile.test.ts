// Perfil de `secretario` contra la validación de documentos de sincronización (BE-FR-39; T212). Vive fuera del dominio
// porque lee el esquema real de la app, y el dominio no puede depender de `apps`.
import { describe, expect, it } from 'vitest';
import { SECRETARIO_SYNC_SCHEMA } from '$lib/server/features/apps';
import { validateDocument } from './domain/document-schema';

const MAX_BYTES = 1024 * 1024;

describe('validateDocument con el perfil de secretario', () => {
	it('un documento con las cinco categorías del perfil pasa', () => {
		expect(
			validateDocument(
				SECRETARIO_SYNC_SCHEMA,
				{
					customReplacements: { items: [{ from: 'hola', updatedAt: 0 }], tombstones: [] },
					coreReplacements: { value: [], updatedAt: 0 },
					quickTexts: { value: [], updatedAt: 0 },
					prompts: { value: [], updatedAt: 0 },
					preferences: { language: { value: 'es', updatedAt: 0 } }
				},
				MAX_BYTES
			)
		).toEqual({ ok: true });
	});
});
