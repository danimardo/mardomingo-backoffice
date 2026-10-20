// W45 · estadísticas contra el build con sesión de administrador (BE-FR-54, UX-08; T320): un periodo válido muestra la serie diaria
// con su periodo, unidad y vigencia; un periodo que no es válido pide uno; un periodo sin datos lo indica en lugar de mostrar ceros; y sin
// sesión la página manda al login.
import { beforeAll, describe, expect, inject, it } from 'vitest';
import { loginAsAdmin, type AdminSession } from './admin-session';
import { send } from './client';

const baseUrl = inject('httpBaseUrl');
const databasePath = inject('httpDatabasePath');
const PAGE = '/admin/estadisticas';

let session: AdminSession;

function get(path: string, cookie = session.cookie) {
	return send(baseUrl, path, {
		host: session.webHost,
		headers: { accept: 'text/html', cookie }
	});
}

beforeAll(async () => {
	session = await loginAsAdmin(baseUrl, databasePath, {
		id: 'usr_http_estadisticas_admin',
		email: 'admin.estadisticas.http@ejemplo.es',
		password: 'contraseña-estadisticas-http-123'
	});
});

describe('estadísticas con sesión de administrador (W45, T320)', () => {
	it('un periodo válido muestra la serie diaria con su periodo, unidad y vigencia', async () => {
		const result = await get(`${PAGE}?desde=2026-10-01&hasta=2026-10-31`);

		expect(result.status).toBe(200);
		expect(result.text).toContain('Ingresos por día');
		expect(result.text).toContain('Costes por día');
		expect(result.text).toContain('2026-10-01 – 2026-10-31');
		expect(result.text).toContain('Cifras del periodo seleccionado');
	});

	it('un periodo que no es válido pide uno válido', async () => {
		const result = await get(`${PAGE}?desde=2026-10-31&hasta=2026-10-01`);

		expect(result.status).toBe(200);
		expect(result.text).toContain('Indica un periodo válido para ver el informe.');
	});

	it('un periodo sin datos marca «sin datos» en lugar de cero', async () => {
		const result = await get(`${PAGE}?desde=2000-01-01&hasta=2000-01-31`);

		expect(result.status).toBe(200);
		expect(result.text).toMatch(/sin datos/i);
	});

	it('sin sesión la página manda al login', async () => {
		const result = await send(baseUrl, PAGE, {
			host: session.webHost,
			headers: { accept: 'text/html' }
		});

		expect(result.status).toBe(303);
	});
});
