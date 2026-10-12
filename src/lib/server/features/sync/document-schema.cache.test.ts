// Caché del esquema de sincronización (T215): solo sirve con la misma fecha de modificación de la app.
import { describe, expect, it } from 'vitest';
import { cachedSyncSchema, storeSyncSchema } from './document-schema.cache';

const SCHEMA = { categories: { notas: { strategy: 'block' as const } } };

describe('document-schema.cache', () => {
	it('devuelve el esquema guardado mientras la fecha de la app no cambie', () => {
		storeSyncSchema('app_cache_a', 100, SCHEMA);

		expect(cachedSyncSchema('app_cache_a', 100)).toBe(SCHEMA);
	});

	it('si la app cambió (otra fecha), la entrada no sirve', () => {
		storeSyncSchema('app_cache_b', 100, SCHEMA);

		expect(cachedSyncSchema('app_cache_b', 200)).toBeUndefined();
	});

	it('una app sin entrada no tiene esquema cacheado', () => {
		expect(cachedSyncSchema('app_cache_nunca', 1)).toBeUndefined();
	});
});
