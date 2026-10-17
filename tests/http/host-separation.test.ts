// Separación por host (contracts/api-v1.md 1.1 y 1.8; constitución «Rutas y dominios»). Un cruce entre la API y la
// web responde 404 sin ejecutar la ruta. El healthcheck responde con cualquier Host (D-19).
import { describe, expect, inject, it } from 'vitest';
import { jsonOf, send } from './client';

const baseUrl = inject('httpBaseUrl');
const webHost = `localhost:${new URL(baseUrl).port}`;

describe('separación por host', () => {
	it('la API no sirve rutas web (404)', async () => {
		const result = await send(baseUrl, '/client-errors', { method: 'POST' });

		expect(result.status).toBe(404);
	});

	it('la web no sirve rutas de la API (404 sin formato de error)', async () => {
		const result = await send(baseUrl, '/api/v1/openapi.json', { host: webHost });

		expect(result.status).toBe(404);
		expect(result.text).not.toContain('"error"');
	});

	it('el healthcheck responde 200 con cualquier Host', async () => {
		const result = await send(baseUrl, '/api/v1/health', { host: 'cualquiera.example' });

		expect(jsonOf(result)).toEqual({ status: 'ok' });
	});

	it('la web sirve su página y el error 404 con código de referencia', async () => {
		const result = await send(baseUrl, '/no-existe', { host: webHost });

		expect(result.status).toBe(404);
		expect(result.text).toContain('Código de referencia');
	});
});
