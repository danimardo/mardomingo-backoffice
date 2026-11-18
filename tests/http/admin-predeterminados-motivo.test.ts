// S-02 · W42 y W43 no piden motivo y su auditoría no guarda ni el motivo ni los valores anterior/nuevo (BE-FR-55: «valores
// anterior/nuevo y motivo»; contracts/web-routes.md 1.4: «el motivo es obligatorio»; T321 cuenta estas dos acciones en la matriz
// de motivo obligatorio). `updateDefaults` y `applyCopyAsDefaults` (sync/service.ts:192-204 y 241-253) graban `before: null`,
// `after: null` y un texto fijo como `reason`; las rutas no leen `motivo`. La matriz de `admin-motivo.test.ts` pasa por
// casualidad: con `motivo=&confirmado=true` y sin más campos falla antes `JSON.parse('')` (W42) o `NOTHING_SELECTED` (W43).
// Copiar a: tests/http/admin-predeterminados-motivo.test.ts
// Ejecutar (contra el build): pnpm build && pnpm exec vitest run --project http tests/http/admin-predeterminados-motivo.test.ts
// Debe FALLAR hoy: con datos válidos y motivo vacío responde 303 y audita; con motivo, `reason` es el texto fijo.
import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { loginAsAdmin, postAdmin, type AdminSession } from './admin-session';

const baseUrl = inject('httpBaseUrl');
const databasePath = inject('httpDatabasePath');
const PAGE = '/admin/apps/secretario/predeterminados';
const GUARDAR = `${PAGE}?/guardarPredeterminados`;
const COPIAR = `${PAGE}/copiar?/copiar`;
const ADMIN_ID = 'usr_http_predet_motivo_admin';

let session: AdminSession;
let appId = '';
let defaultsBefore: string | null = null;

function audits(
	action: string
): { reason: string | null; before: string | null; after: string | null }[] {
	const db = new Database(databasePath, { readonly: true });
	try {
		return db
			.prepare<[string], { reason: string | null; before: string | null; after: string | null }>(
				'SELECT reason, before, after FROM admin_audit WHERE action = ? ORDER BY rowid'
			)
			.all(action);
	} finally {
		db.close();
	}
}

beforeAll(async () => {
	session = await loginAsAdmin(baseUrl, databasePath, {
		id: ADMIN_ID,
		email: 'admin.predet.motivo.http@ejemplo.es',
		password: 'contraseña-predet-motivo-123'
	});
	const db = new Database(databasePath);
	try {
		appId =
			db.prepare<[], { id: string }>("SELECT id FROM apps WHERE slug = 'secretario'").get()?.id ??
			'';
		defaultsBefore =
			db
				.prepare<[string], { data: string }>('SELECT data FROM app_defaults WHERE app_id = ?')
				.get(appId)?.data ?? null;
		const ahora = Date.now();
		db.prepare('DELETE FROM sync_documents WHERE user_id = ? AND app_id = ?').run(ADMIN_ID, appId);
		db.prepare(
			`INSERT INTO sync_documents (user_id, app_id, revision, data, created_at, updated_at)
			 VALUES (?, ?, 1, ?, ?, ?)`
		).run(
			ADMIN_ID,
			appId,
			JSON.stringify({ preferences: { language: { value: 'es', updatedAt: 1 } } }),
			ahora,
			ahora
		);
	} finally {
		db.close();
	}
});

afterAll(() => {
	const db = new Database(databasePath);
	try {
		if (defaultsBefore === null) db.prepare('DELETE FROM app_defaults WHERE app_id = ?').run(appId);
		else db.prepare('UPDATE app_defaults SET data = ? WHERE app_id = ?').run(defaultsBefore, appId);
		db.prepare('DELETE FROM sync_documents WHERE user_id = ?').run(ADMIN_ID);
	} finally {
		db.close();
	}
});

describe('motivo y valores en la auditoría de predeterminados (S-02, BE-FR-55)', () => {
	it('guardar predeterminados válidos con el motivo vacío responde 400 y no audita', async () => {
		const antes = audits('sync.defaults.updated').length;

		const result = await postAdmin(
			session,
			GUARDAR,
			`datos=${encodeURIComponent('{}')}&motivo=&confirmado=true`
		);

		expect(result.status).toBe(400);
		expect(audits('sync.defaults.updated')).toHaveLength(antes);
	});

	it('copiar un elemento válido con el motivo vacío responde 400 y no audita', async () => {
		const antes = audits('sync.defaults.copied').length;

		const result = await postAdmin(
			session,
			COPIAR,
			`usuario=${ADMIN_ID}&sel%3Apreferences=language&motivo=&confirmado=true`
		);

		expect(result.status).toBe(400);
		expect(audits('sync.defaults.copied')).toHaveLength(antes);
	});

	it('guardar con motivo deja ese motivo y los valores anterior y nuevo en la auditoría', async () => {
		const result = await postAdmin(
			session,
			GUARDAR,
			`datos=${encodeURIComponent('{"quickTexts":{"value":["hola"],"updatedAt":1}}')}&motivo=${encodeURIComponent('Textos de bienvenida')}&confirmado=true`
		);
		expect(result.status).toBe(303);

		const entry = audits('sync.defaults.updated').at(-1);
		expect(entry?.reason).toBe('Textos de bienvenida');
		// La forma exacta de la instantánea es decisión del propietario (p. ej. categorías cambiadas, sin contenido);
		// lo que BE-FR-55 no admite es que falten las dos.
		expect(entry?.before === null && entry.after === null).toBe(false);
	});
});
