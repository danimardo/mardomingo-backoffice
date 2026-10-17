// Comprobación de origen (V17 pasos 1–3; contracts/web-routes.md 1.4; D-01). En el host web, un formulario sin
// `Origin` o con otro origen responde 403 sin ejecutar la action. En el host de la API, un `multipart` sin `Origin`
// no recibe el 403 de origen (las apps de escritorio no envían Origin).
import { describe, expect, inject, it } from 'vitest';
import { send } from './client';

const baseUrl = inject('httpBaseUrl');
const port = new URL(baseUrl).port;
const webHost = `localhost:${port}`;
const webOrigin = `http://localhost:${port}`;

const form = { 'content-type': 'application/x-www-form-urlencoded', accept: 'text/html' };

describe('comprobación de origen de los formularios (D-01)', () => {
	it('sin Origin, la action no se ejecuta y responde 403', async () => {
		const result = await send(baseUrl, '/preferencias?/tema', {
			method: 'POST',
			host: webHost,
			headers: form,
			body: 'theme=dark'
		});

		expect(result.status).toBe(403);
		expect(result.headers['set-cookie']).toBeUndefined();
	});

	it('con otro Origin, responde 403 sin ejecutar la action', async () => {
		const result = await send(baseUrl, '/preferencias?/tema', {
			method: 'POST',
			host: webHost,
			headers: { ...form, origin: 'https://evil.example' },
			body: 'theme=dark'
		});

		expect(result.status).toBe(403);
		expect(result.headers['set-cookie']).toBeUndefined();
	});

	it('con el Origin de PUBLIC_WEB_URL, la action se ejecuta', async () => {
		const result = await send(baseUrl, '/preferencias?/tema', {
			method: 'POST',
			host: webHost,
			headers: { ...form, origin: webOrigin },
			body: 'theme=dark&redirectTo=%2Fpreferencias'
		});

		expect(result.status).toBe(303);
		expect(String(result.headers['set-cookie'])).toContain('mdm_theme=dark');
	});

	it('un multipart sin Origin al host de la API no recibe el 403 de origen', async () => {
		const result = await send(baseUrl, '/api/v1/no-existe', {
			method: 'POST',
			headers: { 'content-type': 'multipart/form-data; boundary=x' },
			body: '--x--'
		});

		expect(result.status).not.toBe(403);
	});
});
