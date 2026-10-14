// E06 `POST /api/v1/me/accept-terms` contra el build (T278; BE-FR-70/CA2; api-v1 E06). Usa la cuenta de chat con token Bearer de
// la app `secretario`. Las aceptaciones de la cuenta se restauran al terminar, igual que en api-sync.test.ts.
import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { send } from './client';

const baseUrl = inject('httpBaseUrl');
const token = inject('httpChatToken');
const databasePath = inject('httpDatabasePath');
const apiHost = new URL(baseUrl).host;
const CHAT_USER_ID = 'usr_http_chat';

const headers = {
	'content-type': 'application/json',
	accept: 'application/json',
	'x-app-id': 'secretario',
	'x-app-version': '4.0.0',
	authorization: `Bearer ${token}`
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function errorOf(text: string): { code: unknown; details: Record<string, unknown> } {
	const parsed: unknown = JSON.parse(text);
	const error = isRecord(parsed) ? parsed.error : undefined;
	if (!isRecord(error)) throw new Error('sin error en formato 7.1');
	return { code: error.code, details: isRecord(error.details) ? error.details : {} };
}

function currentVersion(document: string): string {
	const sqlite = new Database(databasePath, { readonly: true });
	try {
		const row: unknown = sqlite
			.prepare(
				'SELECT version FROM legal_documents WHERE document = ? ORDER BY published_at DESC LIMIT 1'
			)
			.get(document);
		if (!isRecord(row) || typeof row.version !== 'string') {
			throw new Error(`sin versión de ${document}`);
		}
		return row.version;
	} finally {
		sqlite.close();
	}
}

const accept = (body: unknown, extra: Record<string, string> = {}) =>
	send(baseUrl, '/api/v1/me/accept-terms', {
		method: 'POST',
		host: apiHost,
		headers: { ...headers, ...extra },
		body: typeof body === 'string' ? body : JSON.stringify(body)
	});

type AcceptanceRow = Record<string, unknown>;

/** Copia exacta de las aceptaciones de la cuenta de chat, para restaurarlas al terminar. */
function snapshotAcceptances(): AcceptanceRow[] {
	const sqlite = new Database(databasePath, { readonly: true });
	try {
		const rows: unknown = sqlite
			.prepare('SELECT * FROM terms_acceptances WHERE user_id = ?')
			.all(CHAT_USER_ID);
		return Array.isArray(rows) ? rows.filter(isRecord) : [];
	} finally {
		sqlite.close();
	}
}

function replaceAcceptances(rows: AcceptanceRow[]): void {
	const sqlite = new Database(databasePath);
	try {
		sqlite.prepare('DELETE FROM terms_acceptances WHERE user_id = ?').run(CHAT_USER_ID);
		for (const row of rows) {
			const columns = Object.keys(row);
			sqlite
				.prepare(
					`INSERT INTO terms_acceptances (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`
				)
				.run(...columns.map((column) => row[column]));
		}
	} finally {
		sqlite.close();
	}
}

describe('E06 · POST /api/v1/me/accept-terms', () => {
	let saved: AcceptanceRow[] = [];

	beforeAll(() => {
		saved = snapshotAcceptances();
		replaceAcceptances([]);
	});

	afterAll(() => {
		// Restaurar: las pruebas de chat esperan la cuenta con sus aceptaciones originales.
		replaceAcceptances(saved);
	});

	it('acepta la versión vigente con 204 y repetirla sigue con 204 (idempotente)', async () => {
		const body = { documents: [{ document: 'terms', version: currentVersion('terms') }] };

		expect((await accept(body)).status).toBe(204);
		expect((await accept(body)).status).toBe(204);
	});

	it('una versión que ya no es la vigente responde VALIDATION_ERROR en documents', async () => {
		const response = await accept({ documents: [{ document: 'privacy', version: '1999-01-01' }] });

		expect(response.status).toBe(400);
		expect(errorOf(response.text)).toMatchObject({
			code: 'VALIDATION_ERROR',
			details: { field: 'documents' }
		});
	});

	it('un documento repetido responde VALIDATION_ERROR', async () => {
		const version = currentVersion('terms');
		const response = await accept({
			documents: [
				{ document: 'terms', version },
				{ document: 'terms', version }
			]
		});

		expect(response.status).toBe(400);
		expect(errorOf(response.text).code).toBe('VALIDATION_ERROR');
	});

	it('una lista vacía o un documento desconocido responde VALIDATION_ERROR', async () => {
		expect((await accept({ documents: [] })).status).toBe(400);
		expect((await accept({ documents: [{ document: 'inventado', version: '1' }] })).status).toBe(
			400
		);
	});

	it('sin token responde UNAUTHENTICATED', async () => {
		const response = await send(baseUrl, '/api/v1/me/accept-terms', {
			method: 'POST',
			host: apiHost,
			headers: {
				'content-type': 'application/json',
				accept: 'application/json',
				'x-app-id': 'secretario',
				'x-app-version': '4.0.0'
			},
			body: JSON.stringify({ documents: [{ document: 'terms', version: '1' }] })
		});

		expect(response.status).toBe(401);
		expect(errorOf(response.text).code).toBe('UNAUTHENTICATED');
	});

	it('sin versión de app responde UPGRADE_REQUIRED', async () => {
		const response = await send(baseUrl, '/api/v1/me/accept-terms', {
			method: 'POST',
			host: apiHost,
			headers: { ...headers, 'x-app-version': '3.0.0' },
			body: JSON.stringify({ documents: [{ document: 'terms', version: currentVersion('terms') }] })
		});

		expect(response.status).toBe(426);
		expect(errorOf(response.text).code).toBe('UPGRADE_REQUIRED');
	});
});
