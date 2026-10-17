// Acceso al área de administración contra el build (BE-FR-10; T301): sin sesión, al inicio de sesión; un Bearer no abre nada en la
// web; y las páginas de administración no entregan contenido sin sesión de administrador.
import { describe, expect, inject, it } from 'vitest';
import { send } from './client';

const baseUrl = inject('httpBaseUrl');
const port = new URL(baseUrl).port;
const webHost = `localhost:${port}`;

describe('acceso a la administración (W46–W47) en el host web', () => {
	for (const path of [
		'/admin/auditoria',
		'/admin/auditoria/aud_inexistente',
		'/admin/usuarios',
		'/admin/usuarios/usr_inexistente'
	]) {
		it(`${path} sin sesión manda al login y no entrega nada`, async () => {
			const result = await send(baseUrl, path, { host: webHost, headers: { accept: 'text/html' } });

			expect(result.status).toBe(303);
			expect(String(result.headers.location)).toContain('/login');
			expect(result.text).not.toContain('admin_audit');
		});
	}

	it('un Bearer en la web no abre la administración', async () => {
		const result = await send(baseUrl, '/admin/auditoria', {
			host: webHost,
			headers: { authorization: 'Bearer token-de-una-app', accept: 'text/html' }
		});

		expect(result.status).toBe(303);
		expect(String(result.headers.location)).toContain('/login');
	});
});
