// `POST /client-errors` (contracts/web-routes.md; contracts/log-events.md 2.4). Siempre 204: no revela si el informe
// se aceptó. Un cuerpo de más de 4 KB se descarta igualmente sin procesarlo.
import { describe, expect, inject, it } from 'vitest';
import { send } from './client';

const baseUrl = inject('httpBaseUrl');
const webHost = `localhost:${new URL(baseUrl).port}`;
const headers = { 'content-type': 'application/json' };

describe('informes del navegador', () => {
	it('un informe válido responde 204', async () => {
		const result = await send(baseUrl, '/client-errors', {
			method: 'POST',
			host: webHost,
			headers,
			body: JSON.stringify({
				name: 'TypeError',
				fingerprint: 'a1b2c3d4',
				frames: ['at render (app.js:1:2)'],
				version: '1.0.0',
				count: 1
			})
		});

		expect(result.status).toBe(204);
	});

	it('un cuerpo de más de 4 KB responde 204 sin procesarlo', async () => {
		const result = await send(baseUrl, '/client-errors', {
			method: 'POST',
			host: webHost,
			headers,
			body: JSON.stringify({ name: 'x'.repeat(5000) })
		});

		expect(result.status).toBe(204);
	});

	it('un cuerpo con claves desconocidas responde 204', async () => {
		const result = await send(baseUrl, '/client-errors', {
			method: 'POST',
			host: webHost,
			headers,
			body: JSON.stringify({ message: 'no debe llegar al servidor' })
		});

		expect(result.status).toBe(204);
	});
});
