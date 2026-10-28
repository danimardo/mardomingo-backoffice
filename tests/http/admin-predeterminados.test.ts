// W42–W43 · predeterminados de una app contra el build con sesión de administrador (BE-FR-42 CA3–CA4, BE-FR-57; T312): los
// predeterminados solo se guardan con confirmación, un JSON que no es válido o no cumple el esquema de sincronización responde 400 sin
// auditoría, y copiar desde una cuenta exige al menos un elemento marcado (400 NOTHING_SELECTED). Ninguna prueba modifica cuentas.
import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { loginAsAdmin, postAdmin, type AdminSession } from './admin-session';
import { send } from './client';

const baseUrl = inject('httpBaseUrl');
const databasePath = inject('httpDatabasePath');
const PAGE = '/admin/apps/secretario/predeterminados';
const GUARDAR = `${PAGE}?/guardarPredeterminados`;
const COPIAR = `${PAGE}/copiar?/copiar`;

let session: AdminSession;
const USUARIO = 'usr_http_copia_origen';
const ADMIN_ID = 'usr_http_predet_admin';
let defaultsBefore: string | null = null;
let appId = '';

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
	const db = new Database(databasePath);
	try {
		appId =
			db.prepare<[], { id: string }>("SELECT id FROM apps WHERE slug = 'secretario'").get()?.id ??
			'';
		const ahora = Date.now();
		db.prepare(
			`INSERT INTO user (id, name, email, email_verified, role, banned, email_normalized, created_at, updated_at)
			 VALUES (?, '', ?, 1, 'user', 0, ?, ?, ?)`
		).run(USUARIO, 'copia.origen@ejemplo.es', 'copia.origen@ejemplo.es', ahora, ahora);
		db.prepare(
			`INSERT INTO sync_documents (user_id, app_id, revision, data, created_at, updated_at)
			 VALUES (?, ?, 1, ?, ?, ?)`
		).run(
			USUARIO,
			appId,
			JSON.stringify({ preferences: { language: { value: 'es', updatedAt: 1 } } }),
			ahora,
			ahora
		);
		defaultsBefore =
			db
				.prepare<[string], { data: string }>('SELECT data FROM app_defaults WHERE app_id = ?')
				.get(appId)?.data ?? null;
	} finally {
		db.close();
	}
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
			`usuario=${ADMIN_ID}&motivo=Sin+elementos&confirmado=true`
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

	it('copiar desde la cuenta de otro usuario responde 403 y no copia ni audita (D03 = R13)', async () => {
		const audit = auditCount('sync.defaults.copied');

		const result = await postAdmin(
			session,
			COPIAR,
			`usuario=${USUARIO}&sel%3Apreferences=language&motivo=Copia+ajena&confirmado=true`
		);

		expect(result.status).toBe(403);
		expect(auditCount('sync.defaults.copied')).toBe(audit);
	});

	it('la copia toma el elemento marcado del propio documento del administrador, lo deja en predeterminados y audita (CA3–CA4)', async () => {
		const audit = auditCount('sync.defaults.copied');
		// D03: la cuenta origen es siempre la del propio administrador. Se siembra su documento aquí para esta prueba.
		const siembra = new Database(databasePath);
		try {
			siembra
				.prepare('DELETE FROM sync_documents WHERE user_id = ? AND app_id = ?')
				.run(ADMIN_ID, appId);
			siembra
				.prepare(
					`INSERT INTO sync_documents (user_id, app_id, revision, data, created_at, updated_at)
					 VALUES (?, ?, 1, ?, ?, ?)`
				)
				.run(
					ADMIN_ID,
					appId,
					JSON.stringify({ preferences: { language: { value: 'es', updatedAt: 1 } } }),
					Date.now(),
					Date.now()
				);
		} finally {
			siembra.close();
		}
		const vista = await send(baseUrl, `${PAGE}/copiar?vista=propia`, {
			host: session.webHost,
			headers: { accept: 'text/html', cookie: session.cookie }
		});
		expect(vista.text).toContain('language');

		const copiado = await postAdmin(
			session,
			COPIAR,
			`usuario=${ADMIN_ID}&sel%3Apreferences=language&motivo=Copia+de+prueba&confirmado=true`
		);
		expect(copiado.status).toBe(303);
		expect(auditCount('sync.defaults.copied')).toBe(audit + 1);

		const db = new Database(databasePath, { readonly: true });
		try {
			const fila = db
				.prepare<[string], { data: string }>('SELECT data FROM app_defaults WHERE app_id = ?')
				.get(appId);
			expect(JSON.parse(fila?.data ?? '{}')).toEqual({
				preferences: { language: { value: 'es', updatedAt: 1 } }
			});
		} finally {
			db.close();
		}
	});

	afterAll(() => {
		const db = new Database(databasePath);
		try {
			if (defaultsBefore === null)
				db.prepare('DELETE FROM app_defaults WHERE app_id = ?').run(appId);
			else
				db.prepare('UPDATE app_defaults SET data = ? WHERE app_id = ?').run(defaultsBefore, appId);
			db.prepare('DELETE FROM sync_documents WHERE user_id = ?').run(USUARIO);
		} finally {
			db.close();
		}
	});
});
