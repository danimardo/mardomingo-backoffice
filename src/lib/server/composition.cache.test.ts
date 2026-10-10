import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeLogger } from '../../../tests/builders/fake-logger';
import { parseEnv } from './config/env-schema';
import { createComposition, type Composition } from './composition';

// La caché guarda estado de módulo: cada prueba carga el módulo de nuevo para empezar limpia.
async function loadCache() {
	vi.resetModules();
	return import('./composition.cache');
}

const config = parseEnv({
	APP_ENV: 'test',
	PUBLIC_API_URL: 'http://127.0.0.1:7312',
	PUBLIC_WEB_URL: 'http://localhost:7312',
	BETTER_AUTH_URL: 'http://localhost:7312',
	DATABASE_PATH: ':memory:',
	BETTER_AUTH_SECRET: 'a'.repeat(32),
	EMAIL_HASH_KEY: 'b'.repeat(32)
});

let composition: Composition | undefined;

function current(): Composition {
	if (composition === undefined) throw new Error('la prueba necesita una composición');
	return composition;
}

beforeEach(() => {
	composition = createComposition(config, createFakeLogger());
});

afterEach(() => {
	composition?.close();
	composition = undefined;
});

describe('composition.cache', () => {
	it('lanzar error si se lee antes de inicializar', async () => {
		const cache = await loadCache();

		expect(() => cache.getComposition()).toThrow('falta la inicialización');
	});

	it('devuelve la composición asignada en la inicialización', async () => {
		const cache = await loadCache();
		cache.setComposition(current());

		expect(cache.getComposition()).toBe(current());
	});

	it('rechaza una segunda asignación: la composición es de solo lectura tras init', async () => {
		const cache = await loadCache();
		cache.setComposition(current());

		expect(() => {
			cache.setComposition(current());
		}).toThrow('ya está asignada');
	});
});
