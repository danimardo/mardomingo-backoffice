// W38 · parámetros económicos contra el build con sesión de administrador (BE-FR-61, BE-FR-55; T309): un valor incoherente se
// rechaza, un cambio sin confirmación no se aplica, y un cambio confirmado se aplica, se muestra y queda auditado. El valor se
// restaura al terminar para no alterar a otras pruebas de la misma base.
import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { loginAsAdmin, postAdmin, type AdminSession } from './admin-session';
import { send } from './client';

const baseUrl = inject('httpBaseUrl');
const databasePath = inject('httpDatabasePath');
const KEY = 'min_balance_to_operate';
const DEFAULT_VALUE = '5000000';
const CHANGED_VALUE = '6000000';
const ACTION = '/admin/economia?/guardarParametros';

let session: AdminSession;

function auditCount(): number {
	const db = new Database(databasePath, { readonly: true });
	try {
		const row = db
			.prepare<[string], { n: number }>('SELECT COUNT(*) AS n FROM admin_audit WHERE action = ?')
			.get('apps.setting.update');
		return row?.n ?? 0;
	} finally {
		db.close();
	}
}

async function pageHtml(): Promise<string> {
	const result = await send(baseUrl, '/admin/economia', {
		host: session.webHost,
		headers: { accept: 'text/html', cookie: session.cookie }
	});
	return result.text;
}

beforeAll(async () => {
	session = await loginAsAdmin(baseUrl, databasePath, {
		id: 'usr_http_economia_admin',
		email: 'admin.economia.http@ejemplo.es',
		password: 'contraseña-economia-http-123'
	});
});

afterAll(async () => {
	// Vuelve al valor por defecto para no alterar otras pruebas de la base.
	await postAdmin(
		session,
		ACTION,
		`clave=${KEY}&valor=${DEFAULT_VALUE}&motivo=Restaurar+valor+de+prueba&confirmado=true`
	);
});

describe('parámetros económicos con sesión de administrador (W38, T309)', () => {
	it('la página muestra el valor vigente, el valor por defecto y el origen global', async () => {
		const html = await pageHtml();

		expect(html).toContain('Valor por defecto');
		expect(html).toContain('alcance global');
		expect(html).toContain(`name="valor"`);
	});

	it('un valor incoherente (margen o saldo mínimo fuera de rango) responde 400 y no cambia nada', async () => {
		const antes = auditCount();

		const negativo = await postAdmin(
			session,
			ACTION,
			`clave=${KEY}&valor=-1&motivo=Valor+incoherente&confirmado=true`
		);

		expect(negativo.status).toBe(400);
		expect(auditCount()).toBe(antes);
	});

	it('un cambio sin confirmación responde 400 y no cambia nada', async () => {
		const antes = auditCount();

		const sinConfirmar = await postAdmin(
			session,
			ACTION,
			`clave=${KEY}&valor=${CHANGED_VALUE}&motivo=Sin+confirmar`
		);

		expect(sinConfirmar.status).toBe(400);
		expect(auditCount()).toBe(antes);
	});

	it('un cambio confirmado se aplica, se muestra en la página y queda auditado', async () => {
		const antes = auditCount();

		const aplicado = await postAdmin(
			session,
			ACTION,
			`clave=${KEY}&valor=${CHANGED_VALUE}&motivo=Subida+de+saldo+minimo&confirmado=true`
		);

		expect(aplicado.status).toBe(303);
		expect(auditCount()).toBe(antes + 1);
		expect(await pageHtml()).toContain(`value="${CHANGED_VALUE}"`);
	});
});
