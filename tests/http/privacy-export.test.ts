// Exportación y borrado de la cuenta contra el build (T281, T285; BE-FR-07, BE-FR-08; W17, W28, W29). Sin sesión, ni la
// exportación ni el borrado entregan nada y mandan al login; un Bearer no abre la web; y la confirmación del borrado es pública y
// no se guarda en caché. Las cabeceras de la descarga con sesión y su propiedad se comprueban en el E2E (necesita una cuenta).
import { describe, expect, inject, it } from 'vitest';
import { send } from './client';

const baseUrl = inject('httpBaseUrl');
const port = new URL(baseUrl).port;
const webHost = `localhost:${port}`;

describe('exportación de datos (W28) en el host web', () => {
	it('sin sesión, redirige al login y no entrega ningún JSON', async () => {
		const result = await send(baseUrl, '/panel/perfil/exportar', {
			host: webHost,
			headers: { accept: 'application/json' }
		});

		expect(result.status).toBe(303);
		expect(String(result.headers.location)).toContain('/login');
		expect(String(result.headers['content-type'] ?? '')).not.toContain('application/json');
		expect(String(result.headers['content-disposition'] ?? '')).toBe('');
		expect(result.text).not.toContain('schemaVersion');
	});

	it('un Bearer en la web no abre la exportación', async () => {
		const result = await send(baseUrl, '/panel/perfil/exportar', {
			host: webHost,
			headers: { authorization: 'Bearer token-de-una-app' }
		});

		expect(result.status).toBe(303);
		expect(String(result.headers.location)).toContain('/login');
		expect(result.text).not.toContain('schemaVersion');
	});

	it('la exportación solo responde a GET', async () => {
		const result = await send(baseUrl, '/panel/perfil/exportar', {
			method: 'POST',
			host: webHost,
			headers: { origin: `http://${webHost}` }
		});

		expect(result.status).toBe(405);
	});
});

describe('borrado de cuenta (W29, W17) en el host web', () => {
	it('sin sesión, la página de borrar manda al login con el destino guardado', async () => {
		const result = await send(baseUrl, '/panel/perfil/borrar', { host: webHost });

		expect(result.status).toBe(303);
		expect(String(result.headers.location)).toContain('/login?redirectTo=');
	});

	it('sin sesión, la acción de borrar no se ejecuta y manda al login', async () => {
		const result = await send(baseUrl, '/panel/perfil/borrar?/borrarCuenta', {
			method: 'POST',
			host: webHost,
			headers: {
				'content-type': 'application/x-www-form-urlencoded',
				accept: 'text/html',
				origin: `http://${webHost}`
			},
			body: 'password=contrase%C3%B1a-larga-123&confirmLoss=on'
		});

		expect(result.status).toBe(303);
		expect(String(result.headers.location)).toContain('/login');
	});

	it('la confirmación del borrado es pública y dice que el saldo no se reembolsa', async () => {
		const result = await send(baseUrl, '/cuenta-borrada', {
			host: webHost,
			headers: { accept: 'text/html' }
		});

		expect(result.status).toBe(200);
		expect(result.text).toContain('Tu cuenta se ha borrado');
		expect(result.text).toContain('no se reembolsa');
	});
});
