// Descargas del panel contra el build (T271; BE-FR-49.10, BE-FR-75; W31). Sin sesión, la descarga de factura manda al login; con
// sesión ajena o inexistente responde `404` sin filtrar nada. El PDF real espera a un proveedor de facturación que emita.
import { describe, expect, inject, it } from 'vitest';
import { send } from './client';

const baseUrl = inject('httpBaseUrl');
const port = new URL(baseUrl).port;
const webHost = `localhost:${port}`;

describe('descarga de factura del panel (W31) en el host web', () => {
	it('sin sesión, redirige al login y no entrega nada', async () => {
		const result = await send(baseUrl, '/panel/facturas/inv_inexistente/pdf', {
			host: webHost,
			headers: { accept: 'application/pdf' }
		});

		expect(result.status).toBe(303);
		expect(String(result.headers.location)).toContain('/login');
		expect(String(result.headers['content-type'] ?? '')).not.toContain('application/pdf');
	});
});
