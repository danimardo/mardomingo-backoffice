// C-54 (T445; UX-13, BE-FR-55): publicar una versión legal en W48 (`/admin/legal`) vuelve con `?aviso=saved&auditoria=<id>` y la
// página enlaza con esa entrada. Se publica una versión informativa de la renuncia al desistimiento con el mismo texto que la
// vigente: no exige reaceptación, y las pruebas que la usan leen la versión vigente de la base.
import Database from 'better-sqlite3';
import { beforeAll, describe, inject, it } from 'vitest';
import { loginAsAdmin, postAdmin, type AdminSession } from './admin-session';
import { expectAuditLink } from './saved-link';

const baseUrl = inject('httpBaseUrl');
const databasePath = inject('httpDatabasePath');

let session: AdminSession;

function currentContent(document: string): string {
	const db = new Database(databasePath, { readonly: true });
	try {
		const row = db
			.prepare<[string], { content: string }>(
				'SELECT content FROM legal_documents WHERE document = ? ORDER BY published_at DESC LIMIT 1'
			)
			.get(document);
		if (row === undefined) throw new Error(`falta el documento ${document}`);
		return row.content;
	} finally {
		db.close();
	}
}

beforeAll(async () => {
	session = await loginAsAdmin(baseUrl, databasePath, {
		id: 'usr_http_c54_legal',
		email: 'admin.c54.legal@ejemplo.es',
		password: 'contraseña-c54-legal-123'
	});
});

describe('C-54 · W48 enlaza la publicación con su entrada de auditoría (UX-13)', () => {
	it('publicar una versión vuelve con ?aviso=saved&auditoria=<id>', async () => {
		const body = new URLSearchParams({
			documento: 'withdrawal_waiver',
			version: '2030-01-01',
			contenido: currentContent('withdrawal_waiver'),
			confirmado: 'true'
		});

		const result = await postAdmin(session, '/admin/legal?/publicar', body.toString());

		await expectAuditLink(session, databasePath, result, 'legal.document.publish');
	});
});
