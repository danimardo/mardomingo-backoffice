// Ajuste de saldo de W36 contra el build con sesión de administrador (BE-FR-18, 15.12; T307): la página entrega una clave de
// formulario, un envío confirmado aplica el ajuste una sola vez aunque se repita con la misma clave, y sin clave o sin
// confirmación nada cambia. Los movimientos se cuentan en la base de la prueba.
import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { loginAsAdmin, postAdmin, type AdminSession } from './admin-session';
import { send } from './client';

const baseUrl = inject('httpBaseUrl');
const databasePath = inject('httpDatabasePath');
const ADMIN_ID = 'usr_http_ajuste_admin';
const TARGET_ID = 'usr_http_ajuste_objetivo';
const PASSWORD = 'contraseña-ajuste-http-123';

let session: AdminSession;

function movementsOfTarget(): number {
	const db = new Database(databasePath, { readonly: true });
	try {
		const row = db
			.prepare<[string], { n: number }>(
				"SELECT COUNT(*) AS n FROM credit_movements WHERE user_id = ? AND type = 'adjustment'"
			)
			.get(TARGET_ID);
		return row?.n ?? 0;
	} finally {
		db.close();
	}
}

beforeAll(async () => {
	const db = new Database(databasePath);
	try {
		db.prepare(
			`INSERT INTO user (id, name, email, email_verified, role, banned, email_normalized, created_at, updated_at)
			 VALUES (?, '', ?, 1, 'user', 0, ?, ?, ?)`
		).run(TARGET_ID, 'ajuste.http@ejemplo.es', 'ajuste.http@ejemplo.es', Date.now(), Date.now());
	} finally {
		db.close();
	}
	session = await loginAsAdmin(baseUrl, databasePath, {
		id: ADMIN_ID,
		email: 'admin.ajuste.http@ejemplo.es',
		password: PASSWORD
	});
});

afterAll(() => {
	session = { ...session, cookie: '' };
});

const credito = 'cantidad=2&tipo=credit&bolsa=free&vence=2030-01-01&motivo=Compensaci%C3%B3n';

describe('ajuste de saldo con sesión de administrador (W36, T307)', () => {
	it('la página del ajuste entrega una clave de formulario', async () => {
		const page = await send(baseUrl, `/admin/usuarios/${TARGET_ID}/ajuste`, {
			host: session.webHost,
			headers: { accept: 'text/html', cookie: session.cookie }
		});

		expect(page.status).toBe(200);
		expect(page.text).toMatch(/name="clave" value="[A-Za-z0-9-]{16,64}"/);
	});

	it('un envío confirmado aplica el ajuste y un reenvío con la misma clave no lo repite', async () => {
		const page = await send(baseUrl, `/admin/usuarios/${TARGET_ID}/ajuste`, {
			host: session.webHost,
			headers: { accept: 'text/html', cookie: session.cookie }
		});
		const clave = /name="clave" value="([A-Za-z0-9-]+)"/.exec(page.text)?.[1] ?? '';
		const antes = movementsOfTarget();

		const primero = await postAdmin(
			session,
			`/admin/usuarios/${TARGET_ID}/ajuste?/ajustarSaldo`,
			`${credito}&confirmado=true&clave=${clave}`
		);
		const reenvio = await postAdmin(
			session,
			`/admin/usuarios/${TARGET_ID}/ajuste?/ajustarSaldo`,
			`${credito}&confirmado=true&clave=${clave}`
		);

		expect(primero.status).toBe(303);
		expect(reenvio.status).toBe(303);
		expect(movementsOfTarget()).toBe(antes + 1);
	});

	it('sin clave o sin confirmación responde 400 y no aplica nada', async () => {
		const antes = movementsOfTarget();

		const sinClave = await postAdmin(
			session,
			`/admin/usuarios/${TARGET_ID}/ajuste?/ajustarSaldo`,
			`${credito}&confirmado=true`
		);
		const sinConfirmar = await postAdmin(
			session,
			`/admin/usuarios/${TARGET_ID}/ajuste?/ajustarSaldo`,
			`${credito}&clave=clave-sin-confirmar-123`
		);

		expect(sinClave.status).toBe(400);
		expect(sinConfirmar.status).toBe(400);
		expect(movementsOfTarget()).toBe(antes);
	});
});
