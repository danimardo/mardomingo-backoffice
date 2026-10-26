// Descargas del panel contra el build (T271; BE-FR-49.10, BE-FR-75; W31). Sin sesión, la descarga de factura manda al login; con
// sesión ajena o inexistente responde `404` sin filtrar nada. El PDF real espera a un proveedor de facturación que emita.
import { describe, expect, inject, it } from 'vitest';
import { loginAsUser } from './admin-session';
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

// Exportaciones y factura con una sesión real (T271): cabeceras de descarga, caché privada y `404` sin filtrar.

const databasePath = inject('httpDatabasePath');

describe('descargas del panel con sesión (T271)', () => {
	it('sin sesión, las exportaciones mandan al login', async () => {
		for (const path of ['/panel/movimientos/exportar', '/panel/perfil/exportar']) {
			const result = await send(baseUrl, path, { host: webHost, headers: { accept: '*/*' } });

			expect(result.status).toBe(303);
			expect(String(result.headers.location)).toContain('/login');
		}
	});

	it('exportación de movimientos: descarga con Content-Disposition y caché privada', async () => {
		const session = await loginAsUser(baseUrl, databasePath, {
			id: 'usr_descarga_movimientos',
			email: 'descarga.movimientos@ejemplo.es',
			password: 'contraseña-descarga-mov-123'
		});

		const result = await send(baseUrl, '/panel/movimientos/exportar', {
			host: webHost,
			headers: { accept: '*/*', cookie: session.cookie }
		});

		expect(result.status).toBe(200);
		expect(String(result.headers['content-disposition'] ?? '')).toContain('attachment');
		expect(String(result.headers['cache-control'])).toContain('no-store');
	});

	it('exportación de datos del perfil: descarga con Content-Disposition y caché privada', async () => {
		const session = await loginAsUser(baseUrl, databasePath, {
			id: 'usr_descarga_perfil',
			email: 'descarga.perfil@ejemplo.es',
			password: 'contraseña-descarga-perfil-123'
		});

		const result = await send(baseUrl, '/panel/perfil/exportar', {
			host: webHost,
			headers: { accept: '*/*', cookie: session.cookie }
		});

		expect(result.status).toBe(200);
		expect(String(result.headers['content-disposition'] ?? '')).toContain('attachment');
		expect(String(result.headers['cache-control'])).toContain('no-store');
	});

	it('factura inexistente para el usuario: 404 y nada que descargar', async () => {
		const session = await loginAsUser(baseUrl, databasePath, {
			id: 'usr_descarga_factura',
			email: 'descarga.factura@ejemplo.es',
			password: 'contraseña-descarga-factura-123'
		});

		const result = await send(baseUrl, '/panel/facturas/inv_no_existe/pdf', {
			host: webHost,
			headers: { accept: 'application/pdf', cookie: session.cookie }
		});

		expect(result.status).toBe(404);
	});
});
