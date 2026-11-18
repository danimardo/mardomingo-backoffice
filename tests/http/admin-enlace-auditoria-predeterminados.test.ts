// C-54 (T445; UX-13, BE-FR-55): guardar los predeterminados (W42) y copiarlos desde la propia cuenta (W43) vuelven con
// `?aviso=saved&auditoria=<id>` y la página enlaza con esa entrada. Los predeterminados de `secretario` se restauran al terminar.
import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, inject, it } from 'vitest';
import { loginAsAdmin, postAdmin, type AdminSession } from './admin-session';
import { expectAuditLink } from './saved-link';

const baseUrl = inject('httpBaseUrl');
const databasePath = inject('httpDatabasePath');
const PAGE = '/admin/apps/secretario/predeterminados';
const ADMIN_ID = 'usr_http_c54_predet';

let session: AdminSession;
let appId = '';
let defaultsBefore: string | null = null;

beforeAll(async () => {
	const db = new Database(databasePath);
	try {
		appId =
			db.prepare<[], { id: string }>("SELECT id FROM apps WHERE slug = 'secretario'").get()?.id ??
			'';
		defaultsBefore =
			db
				.prepare<[string], { data: string }>('SELECT data FROM app_defaults WHERE app_id = ?')
				.get(appId)?.data ?? null;
	} finally {
		db.close();
	}
	session = await loginAsAdmin(baseUrl, databasePath, {
		id: ADMIN_ID,
		email: 'admin.c54.predet@ejemplo.es',
		password: 'contraseña-c54-predet-123'
	});
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

describe('C-54 · W42–W43 enlazan cada cambio con su entrada de auditoría (UX-13)', () => {
	it('guardar los predeterminados vuelve con ?aviso=saved&auditoria=<id>', async () => {
		const body = new URLSearchParams({
			datos: defaultsBefore ?? '{}',
			motivo: 'Predeterminados revisados',
			confirmado: 'true'
		});

		const result = await postAdmin(session, `${PAGE}?/guardarPredeterminados`, body.toString());

		await expectAuditLink(session, databasePath, result, 'sync.defaults.updated');
	});

	it('copiar desde la propia cuenta vuelve con ?aviso=saved&auditoria=<id>', async () => {
		const db = new Database(databasePath);
		try {
			const now = Date.now();
			db.prepare(
				`INSERT INTO sync_documents (user_id, app_id, revision, data, created_at, updated_at)
				 VALUES (?, ?, 1, ?, ?, ?)`
			).run(
				ADMIN_ID,
				appId,
				JSON.stringify({ preferences: { language: { value: 'es', updatedAt: 1 } } }),
				now,
				now
			);
		} finally {
			db.close();
		}

		const result = await postAdmin(
			session,
			`${PAGE}/copiar?/copiar`,
			`usuario=${ADMIN_ID}&sel%3Apreferences=language&motivo=Copia+de+prueba&confirmado=true`
		);

		await expectAuditLink(session, databasePath, result, 'sync.defaults.copied');
	});
});
