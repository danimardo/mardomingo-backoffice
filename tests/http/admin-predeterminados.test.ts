// W42–W43 · predeterminados de una app contra el build con sesión de administrador (BE-FR-42 CA3–CA4, BE-FR-57; T312): los
// predeterminados solo se guardan con confirmación, un JSON que no es válido o no cumple el esquema de sincronización responde 400 sin
// auditoría, y copiar desde una cuenta exige al menos un elemento marcado (400 NOTHING_SELECTED). Ninguna prueba modifica cuentas.
import Database from 'better-sqlite3';
import { beforeAll, describe, expect, inject, it } from 'vitest';
import { loginAsAdmin, postAdmin, type AdminSession } from './admin-session';
import { send } from './client';

const baseUrl = inject('httpBaseUrl');
const databasePath = inject('httpDatabasePath');
const PAGE = '/admin/apps/secretario/predeterminados';
const GUARDAR = `${PAGE}?/guardarPredeterminados`;
const COPIAR = `${PAGE}/copiar?/copiar`;

let session: AdminSession;

function auditCount(action: string): number {
	const db = new Database(databasePath, { readonly: true });
	try {
		const row = db
			.prepare<[string], { n: number }>('SELECT COUNT(*) AS n FROM admin_audit WHERE action = ?')
			.get(action);
		return row?.n ?? 0;
	} finally {
		db.close();
	}
}

beforeAll(async () => {
	session = await loginAsAdmin(baseUrl, databasePath, {
		id: 'usr_http_predet_admin',
		email: 'admin.predeterminados.http@ejemplo.es',
		password: 'contraseña-predet-http-123'
	});
});

describe('predeterminados con sesión de administrador (W42–W43, T312)', () => {
	it('la página de predeterminados responde 200', async () => {
		const result = await send(baseUrl, PAGE, {
			host: session.webHost,
			headers: { accept: 'text/html', cookie: session.cookie }
		});

		expect(result.status).toBe(200);
	});

	it('guardar los predeterminados sin confirmación responde 400 y no audita', async () => {
		const antes = auditCount('sync.defaults.updated');

		const result = await postAdmin(
			session,
			GUARDAR,
			`datos=${encodeURIComponent('{"categories":{}}')}&motivo=Sin+confirmar`
		);

		expect(result.status).toBe(400);
		expect(auditCount('sync.defaults.updated')).toBe(antes);
	});

	it('un JSON que no es válido responde 400 y no audita', async () => {
		const antes = auditCount('sync.defaults.updated');

		const result = await postAdmin(
			session,
			GUARDAR,
			`datos=${encodeURIComponent('{no-es-json')}&motivo=JSON+roto&confirmado=true`
		);

		expect(result.status).toBe(400);
		expect(auditCount('sync.defaults.updated')).toBe(antes);
	});

	it('un JSON que no cumple el esquema de sincronización responde 400 y no audita', async () => {
		const antes = auditCount('sync.defaults.updated');

		const result = await postAdmin(
			session,
			GUARDAR,
			`datos=${encodeURIComponent('{"no":"es-un-documento"}')}&motivo=Esquema+incorrecto&confirmado=true`
		);

		expect(result.status).toBe(400);
		expect(auditCount('sync.defaults.updated')).toBe(antes);
	});

	it('copiar sin confirmación responde 400', async () => {
		const result = await postAdmin(
			session,
			COPIAR,
			'usuario=usr_inexistente&sel%3Apreferencias=dato'
		);

		expect(result.status).toBe(400);
	});

	it('copiar sin ningún elemento marcado responde 400 NOTHING_SELECTED y no copia nada', async () => {
		const antes = auditCount('sync.defaults.copied');

		const result = await postAdmin(
			session,
			COPIAR,
			'usuario=usr_inexistente&motivo=Sin+elementos&confirmado=true'
		);

		expect(result.status).toBe(400);
		expect(auditCount('sync.defaults.copied')).toBe(antes);
	});

	it('copiar sin indicar la cuenta origen responde 400', async () => {
		const result = await postAdmin(
			session,
			COPIAR,
			'sel%3Apreferencias=dato&motivo=Sin+cuenta&confirmado=true'
		);

		expect(result.status).toBe(400);
	});
});
