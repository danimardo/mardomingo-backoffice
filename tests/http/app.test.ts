// Pruebas HTTP contra la aplicación construida (R16; T035). El servidor lo arranca `http.global-setup.ts` con
// la API en 127.0.0.1 y la web en localhost (mismo puerto): la separación depende del `Host` de la petición.
import { describe, expect, inject, it } from 'vitest';
import { jsonOf, send } from './client';

const baseUrl = inject('httpBaseUrl');
const port = new URL(baseUrl).port;
const webHost = `localhost:${port}`;
const webOrigin = `http://localhost:${port}`;

describe('API /api/v1', () => {
	it('el healthcheck responde 200 con no-store y un X-Request-Id', async () => {
		const result = await send(baseUrl, '/api/v1/health');

		expect(result.status).toBe(200);
		expect(jsonOf(result)).toEqual({ status: 'ok' });
		expect(result.headers['cache-control']).toBe('no-store');
		expect(result.headers['x-request-id']).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
		);
	});

	it('el healthcheck responde con cualquier Host (D-19)', async () => {
		const result = await send(baseUrl, '/api/v1/health', { host: 'otro.example' });

		expect(result.status).toBe(200);
	});

	it('una ruta de la API sin implementar responde 404 NOT_FOUND en formato 7.1', async () => {
		const result = await send(baseUrl, '/api/v1/no-existe');

		expect(result.status).toBe(404);
		expect(jsonOf(result)).toMatchObject({ error: { code: 'NOT_FOUND' } });
	});

	it('un método no previsto responde 405 con Allow', async () => {
		const result = await send(baseUrl, '/api/v1/health', { method: 'POST' });

		expect(result.status).toBe(405);
		expect(result.headers.allow).toBe('GET');
	});

	it('el documento OpenAPI declara la versión 3.1', async () => {
		const result = await send(baseUrl, '/api/v1/openapi.json');

		expect(result.status).toBe(200);
		expect(jsonOf(result)).toMatchObject({ openapi: '3.1.0' });
	});
});

describe('separación por host', () => {
	it('el host de la API no sirve rutas web: 404', async () => {
		const result = await send(baseUrl, '/client-errors', { method: 'POST' });

		expect(result.status).toBe(404);
	});

	it('el host web no sirve la API: 404', async () => {
		const result = await send(baseUrl, '/api/v1/openapi.json', { host: webHost });

		expect(result.status).toBe(404);
	});
});

describe('informes del navegador', () => {
	it('un informe válido se acepta con 204 sin cuerpo', async () => {
		const result = await send(baseUrl, '/client-errors', {
			method: 'POST',
			host: webHost,
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				name: 'TypeError',
				fingerprint: 'a1b2c3d4',
				frames: ['at render (app.js:1:2)'],
				version: '1.0.0',
				count: 1
			})
		});

		expect(result.status).toBe(204);
		expect(result.text).toBe('');
	});

	it('un cuerpo inválido también responde 204: no revela si se aceptó', async () => {
		const result = await send(baseUrl, '/client-errors', {
			method: 'POST',
			host: webHost,
			headers: { 'content-type': 'application/json' },
			body: '{"message":"no permitido"}'
		});

		expect(result.status).toBe(204);
	});
});

describe('comprobación de origen de los formularios (D-01)', () => {
	const formHeaders = { 'content-type': 'application/x-www-form-urlencoded' };

	it('un formulario sin Origin se rechaza con 403 antes de ejecutar nada', async () => {
		const result = await send(baseUrl, '/no-existe', {
			method: 'POST',
			host: webHost,
			headers: formHeaders,
			body: 'tema=dark'
		});

		expect(result.status).toBe(403);
		expect(result.headers['x-request-id']).toBeDefined();
	});

	it('un formulario con un Origin ajeno se rechaza con 403', async () => {
		const result = await send(baseUrl, '/no-existe', {
			method: 'POST',
			host: webHost,
			headers: { ...formHeaders, origin: 'https://evil.example' },
			body: 'tema=dark'
		});

		expect(result.status).toBe(403);
	});

	it('un formulario con el Origin propio pasa la comprobación', async () => {
		const result = await send(baseUrl, '/no-existe', {
			method: 'POST',
			host: webHost,
			headers: { ...formHeaders, origin: webOrigin },
			body: 'tema=dark'
		});

		expect(result.status).toBe(404);
	});
});

describe('cabeceras de seguridad y de petición', () => {
	it('las páginas llevan X-Request-Id y cabeceras de seguridad', async () => {
		const result = await send(baseUrl, '/no-existe', { host: webHost });

		expect(result.headers['x-request-id']).toBeDefined();
		expect(result.headers['x-content-type-options']).toBe('nosniff');
		expect(result.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
	});
});

describe('preferencias de apariencia (W16)', () => {
	// Un formulario de navegador pide HTML: así SvelteKit responde con el redirect (303) y no con JSON.
	const formHeaders = {
		'content-type': 'application/x-www-form-urlencoded',
		accept: 'text/html',
		origin: webOrigin
	};

	it('guardar el tema responde 303 a la página de retorno y fija la cookie', async () => {
		const result = await send(baseUrl, '/preferencias?/tema', {
			method: 'POST',
			host: webHost,
			headers: formHeaders,
			body: 'theme=dark&redirectTo=%2Fpreferencias'
		});

		expect(result.status).toBe(303);
		expect(result.headers.location).toBe('/preferencias');
		const cookies = [result.headers['set-cookie']].flat().join(';');
		expect(cookies).toContain('mdm_theme=dark');
		expect(cookies).toContain('HttpOnly');
	});

	it('la página pinta el tema elegido en <html> desde la cookie, sin destello', async () => {
		const result = await send(baseUrl, '/preferencias', {
			host: webHost,
			headers: { cookie: 'mdm_theme=dark; mdm_effects=reduced' }
		});

		expect(result.status).toBe(200);
		expect(result.text).toContain('data-theme="dark"');
		expect(result.text).toContain('data-effects="reduced"');
	});

	it('un tema que no existe falla con 400 y no cambia la cookie', async () => {
		const result = await send(baseUrl, '/preferencias?/tema', {
			method: 'POST',
			host: webHost,
			headers: formHeaders,
			body: 'theme=verde'
		});

		expect(result.status).toBe(400);
		expect(result.headers['set-cookie']).toBeUndefined();
	});

	it('los efectos sin casilla marcada borran la cookie (normal)', async () => {
		const result = await send(baseUrl, '/preferencias?/efectos', {
			method: 'POST',
			host: webHost,
			headers: formHeaders,
			body: 'redirectTo=%2F'
		});

		expect(result.status).toBe(303);
		expect([result.headers['set-cookie']].flat().join(';')).toContain('mdm_effects=;');
	});
});

describe('páginas de error', () => {
	it('una página inexistente muestra el código de referencia', async () => {
		const result = await send(baseUrl, '/no-existe', { host: webHost });

		expect(result.status).toBe(404);
		expect(result.text).toContain('Código de referencia');
		expect(result.headers['x-request-id']).toBeDefined();
	});
});
