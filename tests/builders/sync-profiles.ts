// Perfiles de sincronización para las pruebas (T219): un esquema con una categoría de cada estrategia, y otro distinto para
// una segunda app. Son esquemas de prueba; el de `secretario` es el real y lo cubre `profile.test.ts`.
import type { SyncSchema } from '$lib/server/features/sync/domain/schema-types';

/** Una categoría de cada estrategia: `items` (con marcas), `block` y `keyed`. */
export const ALL_STRATEGIES_SCHEMA: SyncSchema = {
	categories: {
		replacements: { strategy: 'items', key: 'from', tombstone_ttl_days: 30 },
		prompts: { strategy: 'block' },
		preferences: { strategy: 'keyed', keys: ['language', 'autoCopy'] }
	}
};

/** Esquema de la segunda app de prueba: distinto, para comprobar el aislamiento. */
export const NOTES_SCHEMA: SyncSchema = {
	categories: {
		notas: { strategy: 'block' }
	}
};

/** Un documento válido para `ALL_STRATEGIES_SCHEMA`, con las fechas y marcas que pide cada estrategia. */
export function allStrategiesDocument(stamp: number, from = 'hola'): Record<string, unknown> {
	return {
		replacements: { items: [{ from, updatedAt: stamp, text: 'buenas' }], tombstones: [] },
		prompts: { value: ['resumen'], updatedAt: stamp },
		preferences: { language: { value: 'es', updatedAt: stamp } }
	};
}
