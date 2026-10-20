// Páginas públicas W01–W07 contra el build (T353; BE-FR-60, US11 escenario 4): solo cookies técnicas, ninguna de analítica ni
// aviso de consentimiento, y el HTML no referencia ningún dominio externo (ni imágenes, ni scripts, ni hojas de estilo, ni
// fuentes). Los enlaces `<a>` externos que configure el administrador no son recursos de la página.
import { describe, expect, inject, it } from 'vitest';
import { send } from './client';

const baseUrl = inject('httpBaseUrl');
const port = new URL(baseUrl).port;
const host = `localhost:${port}`;

const PUBLIC_PAGES = [
	'/',
	'/apps/secretario',
	'/precios',
	'/terminos',
	'/privacidad',
	'/cookies',
	'/uso-aceptable'
] as const;

/** Atributos que cargan recursos: si apuntan a otro origen, la página depende de un tercero. */
const RESOURCE_ATTRIBUTE =
	/<(?:script|img|link|iframe|source|video|audio)\b[^>]*?\s(?:src|href|srcset)="([^"]+)"/gi;

describe.each(PUBLIC_PAGES)('%s', (path) => {
	it('responde 200 y no emite más cookies que las técnicas de preferencias', async () => {
		const result = await send(baseUrl, path, { host, headers: { accept: 'text/html' } });

		expect(result.status).toBe(200);
		const cookies = [result.headers['set-cookie']].flat().filter((cookie) => cookie !== undefined);
		for (const cookie of cookies) {
			expect(cookie).toMatch(/^(?:mdm_theme|mdm_effects|better-auth\.|__Secure-better-auth\.)/);
		}
		expect(cookies.join(';')).not.toMatch(/_ga|_gid|_fbp|analytics|consent/i);
	});

	it('no carga recursos de otros dominios y no muestra aviso de consentimiento', async () => {
		const result = await send(baseUrl, path, { host, headers: { accept: 'text/html' } });

		const external = [...result.text.matchAll(RESOURCE_ATTRIBUTE)]
			.map((match) => match[1] ?? '')
			.filter((url) => /^(?:https?:)?\/\//i.test(url) && !url.startsWith(`http://${host}`));
		expect(external).toStrictEqual([]);
		expect(result.text).not.toMatch(/googletagmanager|google-analytics|facebook\.net|hotjar/i);
		expect(result.text).not.toMatch(/aceptar (?:todas las )?cookies|banner de cookies/i);
	});
});

describe('documentos legales', () => {
	it('/cookies declara la cookie de sesión y las dos de preferencias', async () => {
		const result = await send(baseUrl, '/cookies', { host, headers: { accept: 'text/html' } });

		expect(result.text).toContain('better-auth.session_token');
		expect(result.text).toContain('mdm_theme');
		expect(result.text).toContain('mdm_effects');
	});

	it('una app que no existe responde 404', async () => {
		const result = await send(baseUrl, '/apps/no-existe', {
			host,
			headers: { accept: 'text/html' }
		});
		expect(result.status).toBe(404);
	});

	it('un slug con formato inválido ni llega al load: 404', async () => {
		const result = await send(baseUrl, '/apps/Mal_Formato', {
			host,
			headers: { accept: 'text/html' }
		});
		expect(result.status).toBe(404);
	});
});
