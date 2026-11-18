// C-54 (T445; UX-13, BE-FR-55): crear, guardar y desactivar un anuncio en W49 (`/admin/anuncios`) vuelven con
// `?aviso=saved&auditoria=<id>` y la página enlaza con esa entrada. El anuncio de la prueba empieza en 2099, así que ninguna app lo
// recibe, y termina desactivado.
import Database from 'better-sqlite3';
import { beforeAll, describe, expect, inject, it } from 'vitest';
import { loginAsAdmin, postAdmin, type AdminSession } from './admin-session';
import { expectAuditLink } from './saved-link';

const baseUrl = inject('httpBaseUrl');
const databasePath = inject('httpDatabasePath');
const PAGE = '/admin/anuncios';
const MESSAGE = 'Anuncio de prueba de C-54';

let session: AdminSession;

function announcementBody(extra: Record<string, string> = {}): string {
	return new URLSearchParams({
		appId: '',
		nivel: 'info',
		mensaje: MESSAGE,
		enlace: '',
		inicio: '2099-01-01T00:00',
		fin: '',
		minVersion: '',
		maxVersion: '',
		...extra
	}).toString();
}

function announcementId(): string {
	const db = new Database(databasePath, { readonly: true });
	try {
		const row = db
			.prepare<[string], { id: string }>('SELECT id FROM announcements WHERE message = ?')
			.get(MESSAGE);
		if (row === undefined) throw new Error('falta el anuncio de la prueba');
		return row.id;
	} finally {
		db.close();
	}
}

beforeAll(async () => {
	session = await loginAsAdmin(baseUrl, databasePath, {
		id: 'usr_http_c54_anuncios',
		email: 'admin.c54.anuncios@ejemplo.es',
		password: 'contraseña-c54-anuncios-123'
	});
});

describe('C-54 · W49 enlaza cada cambio con su entrada de auditoría (UX-13)', () => {
	it('crear un anuncio vuelve con ?aviso=saved&auditoria=<id>', async () => {
		const result = await postAdmin(session, `${PAGE}?/crear`, announcementBody());

		await expectAuditLink(session, databasePath, result, 'apps.announcement.create');
	});

	it('guardar un anuncio vuelve con ?aviso=saved&auditoria=<id>', async () => {
		const result = await postAdmin(
			session,
			`${PAGE}?/guardar`,
			announcementBody({ anuncioId: announcementId() })
		);

		await expectAuditLink(session, databasePath, result, 'apps.announcement.update');
	});

	it('desactivar un anuncio vuelve con ?aviso=saved&auditoria=<id>', async () => {
		const id = announcementId();

		const result = await postAdmin(
			session,
			`${PAGE}?/desactivar`,
			`anuncioId=${encodeURIComponent(id)}&motivo=Fin+de+la+prueba&confirmado=true`
		);

		await expectAuditLink(session, databasePath, result, 'apps.announcement.deactivate');
		expect(announcementId()).toBe(id);
	});
});
