// Exportación contable de W51 contra el build con sesión de administrador (BE-FR-76, FR-048; T316): entrar por el login real, descargar
// los tres CSV con sus cabeceras, rechazar un archivo desconocido y mandar sin sesión al login. La cuenta se crea en la base de la prueba.
import Database from 'better-sqlite3';
import { hashPassword } from 'better-auth/crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { send, type HttpResult } from './client';

const baseUrl = inject('httpBaseUrl');
const port = new URL(baseUrl).port;
const webHost = `localhost:${port}`;
const webOrigin = `http://localhost:${port}`;
const PASSWORD = 'contraseña-admin-http-123';
const EMAIL = 'admin.contable@ejemplo.es';
const PERIOD = 'desde=2026-10-01&hasta=2026-10-31';

const form = { 'content-type': 'application/x-www-form-urlencoded', accept: 'text/html' };

let cookie = '';

function cookieOf(result: HttpResult): string {
	const raw = result.headers['set-cookie'];
	const list = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
	return list.map((value) => value.split(';')[0] ?? '').join('; ');
}

beforeAll(async () => {
	const db = new Database(inject('httpDatabasePath'));
	try {
		// Solo un administrador por base (índice `one_admin`): se retira el rol de cualquiera anterior.
		db.prepare("UPDATE user SET role = 'user' WHERE role = 'admin'").run();
		db.prepare(
			`INSERT INTO user (id, name, email, email_verified, role, banned, email_normalized, created_at, updated_at)
			 VALUES ('usr_http_contable', '', ?, 1, 'admin', 0, ?, ?, ?)`
		).run(EMAIL, EMAIL, Date.now(), Date.now());
		db.prepare(
			`INSERT INTO account (id, user_id, account_id, provider_id, password, created_at, updated_at)
			 VALUES ('acc_http_contable', 'usr_http_contable', 'usr_http_contable', 'credential', ?, ?, ?)`
		).run(await hashPassword(PASSWORD), Date.now(), Date.now());
	} finally {
		db.close();
	}
	const login = await send(baseUrl, '/login?/entrar', {
		method: 'POST',
		host: webHost,
		headers: { ...form, origin: webOrigin },
		body: `email=${encodeURIComponent(EMAIL)}&password=${encodeURIComponent(PASSWORD)}&redirectTo=%2Fadmin`
	});
	cookie = cookieOf(login);
});

afterAll(() => {
	cookie = '';
});

describe('exportación contable con sesión de administrador (W51, T316)', () => {
	it('el login de la cuenta administradora deja una cookie de sesión', () => {
		expect(cookie).not.toBe('');
	});

	it.each(['ventas', 'mensual', 'ia'])(
		'el CSV «%s» se descarga como adjunto con su nombre',
		async (archivo) => {
			const result = await send(
				baseUrl,
				`/admin/facturacion/exportar?archivo=${archivo}&${PERIOD}`,
				{
					host: webHost,
					headers: { cookie, accept: 'text/csv' }
				}
			);

			expect(result.status).toBe(200);
			expect(String(result.headers['content-type'])).toContain('text/csv');
			expect(String(result.headers['content-disposition'])).toContain('attachment');
			expect(String(result.headers['content-disposition'])).toContain(
				`contable-${archivo}-2026-10-01-2026-10-31.csv`
			);
			expect(String(result.headers['cache-control'])).toContain('no-store');
		}
	);

	it('un archivo desconocido responde 400 aunque la sesión sea válida', async () => {
		const result = await send(baseUrl, `/admin/facturacion/exportar?archivo=secretos&${PERIOD}`, {
			host: webHost,
			headers: { cookie, accept: 'text/csv' }
		});

		expect(result.status).toBe(400);
	});

	it('sin sesión la exportación manda al login y no entrega datos', async () => {
		const result = await send(baseUrl, `/admin/facturacion/exportar?archivo=ventas&${PERIOD}`, {
			host: webHost,
			headers: { accept: 'text/csv' }
		});

		expect(result.status).toBe(303);
		expect(String(result.headers.location)).toContain('/login');
	});
});
