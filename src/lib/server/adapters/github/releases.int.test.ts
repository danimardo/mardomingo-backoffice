// Adaptador de releases de GitHub contra el simulador (L14; T339): sigue la paginación de `Link`, envía la versión de la API y
// la cabecera `accept`, y no cuenta una respuesta de forma inesperada ni una caída.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GITHUB_RELEASES_PATH, startGitHubMock } from '../../../../../tests/mock-servers/github';
import type { MockServer } from '../../../../../tests/mock-servers/server';
import { fetchPublicReleases, GITHUB_API_VERSION, nextPageOf } from './releases';

const REPO = 'mardomingo/secretario-instalador';
let mock: MockServer;

beforeAll(async () => {
	mock = await startGitHubMock();
});

afterAll(async () => {
	await mock.close();
});

describe('releases de GitHub (T339)', () => {
	it('sigue la paginación y suma los releases de todas las páginas', async () => {
		const releases = await fetchPublicReleases(REPO, { baseUrl: mock.url });

		expect(releases).toHaveLength(2);
		expect(
			releases.flatMap((release) => release.assets.map((asset) => asset.download_count))
		).toEqual([40, 2, 7]);
	});

	it('envía la versión vigente de la API y el tipo de contenido de GitHub', async () => {
		mock.scenario('ok');
		await fetchPublicReleases(REPO, { baseUrl: mock.url });

		const last = mock.requests.at(-1);
		expect(last?.path).toBe(GITHUB_RELEASES_PATH);
		expect(last?.headers['x-github-api-version']).toBe(GITHUB_API_VERSION);
		expect(last?.headers.accept).toBe('application/vnd.github+json');
	});

	it('una caída del proveedor lanza un error (la tarea lo registra y no reintenta)', async () => {
		mock.scenario('down');
		await expect(fetchPublicReleases(REPO, { baseUrl: mock.url })).rejects.toThrow('503');
		mock.scenario('ok');
	});

	it('una respuesta con otra forma no se cuenta', async () => {
		mock.scenario('invalid');
		await expect(fetchPublicReleases(REPO, { baseUrl: mock.url })).rejects.toThrow();
		mock.scenario('ok');
	});

	it('extrae la página siguiente de la cabecera Link, o nada si no hay más', () => {
		expect(nextPageOf(null)).toBeNull();
		expect(
			nextPageOf('<https://a.test/x?page=2>; rel="next", <https://a.test/x?page=5>; rel="last"')
		).toBe('https://a.test/x?page=2');
		expect(nextPageOf('<https://a.test/x?page=1>; rel="prev"')).toBeNull();
	});
});
