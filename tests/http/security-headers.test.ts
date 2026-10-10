// Cabeceras de seguridad y cookies (constitución, «Cabeceras»; FR-102). CSP estricta con nonce y frame-ancestors,
// HSTS, nosniff; las cookies de preferencias son técnicas (Secure, HttpOnly, SameSite=Lax) y no hay cookies de terceros.
import { describe, expect, inject, it } from 'vitest';
import { send } from './client';

const baseUrl = inject('httpBaseUrl');
const port = new URL(baseUrl).port;

describe('cabeceras de seguridad', () => {
	it('las páginas llevan CSP estricta con nonce y frame-ancestors none', async () => {
		const result = await send(baseUrl, '/api/v1/health');
		const page = await send(baseUrl, '/no-existe', { host: `localhost:${port}` });
		const csp = String(page.headers['content-security-policy']);

		expect(csp).toContain("default-src 'self'");
		expect(csp).toContain("frame-ancestors 'none'");
		expect(csp).toMatch(/script-src 'self' 'nonce-[^']+'/);
		expect(csp).not.toContain("'unsafe-inline'");
		expect(result.status).toBe(200);
	});

	it('HSTS, nosniff y la política de referencia están en toda respuesta', async () => {
		const result = await send(baseUrl, '/api/v1/health');

		expect(result.headers['strict-transport-security']).toContain('max-age=');
		expect(result.headers['x-content-type-options']).toBe('nosniff');
		expect(result.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
	});
});

describe('cookies técnicas de preferencias', () => {
	it('mdm_theme es Secure, HttpOnly y SameSite=Lax, y no lleva terceros', async () => {
		const result = await send(baseUrl, '/preferencias?/tema', {
			method: 'POST',
			host: `localhost:${port}`,
			headers: {
				'content-type': 'application/x-www-form-urlencoded',
				accept: 'text/html',
				origin: `http://localhost:${port}`
			},
			body: 'theme=light&redirectTo=%2F'
		});
		const cookies = [result.headers['set-cookie']].flat().join(';');

		expect(cookies).toContain('mdm_theme=light');
		expect(cookies).toContain('Secure');
		expect(cookies).toContain('HttpOnly');
		expect(cookies).toContain('SameSite=Lax');
		expect(cookies).toContain('Path=/');
	});
});
