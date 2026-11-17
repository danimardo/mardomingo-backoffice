// Orden de comprobaciones de la API y sesión Bearer en `/defaults` (C-26, C-28, C-29; T418, T420, T421) contra el build.
// api-v1 1.8: app, sesión 401, versión 426, validación. E12 exige Bearer. E06 registra la app en `terms_acceptances.app_id`.
import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { send } from './client';

const baseUrl = inject('httpBaseUrl');
const token = inject('httpChatToken');
const databasePath = inject('httpDatabasePath');
const apiHost = new URL(baseUrl).host;
const CHAT_USER_ID = 'usr_http_chat';

const appHeaders = {
	accept: 'application/json',
	'x-app-id': 'secretario',
	'x-app-version': '4.0.0'
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function codeOf(text: string): unknown {
	const parsed: unknown = JSON.parse(text);
	const error = isRecord(parsed) ? parsed.error : undefined;
	return isRecord(error) ? error.code : undefined;
}

type AcceptanceRow = Record<string, unknown>;

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

function currentVersion(document: string): string {
	const sqlite = new Database(databasePath, { readonly: true });
	try {
		const row: unknown = sqlite
			.prepare(
				'SELECT version FROM legal_documents WHERE document = ? ORDER BY published_at DESC LIMIT 1'
			)
			.get(document);
		if (!isRecord(row) || typeof row.version !== 'string') throw new Error(`sin ${document}`);
		return row.version;
	} finally {
		sqlite.close();
	}
}

function acceptanceAppId(document: string, version: string): unknown {
	const sqlite = new Database(databasePath, { readonly: true });
	try {
		const row: unknown = sqlite
			.prepare(
				'SELECT app_id AS appId, (SELECT id FROM apps WHERE slug = ?) AS expected FROM terms_acceptances WHERE user_id = ? AND document = ? AND version = ?'
			)
			.get('secretario', CHAT_USER_ID, document, version);
		return row;
	} finally {
		sqlite.close();
	}
}

describe('[C-26] [BE-FR-42/CA2] E12 · GET /api/v1/defaults exige sesión Bearer (BE-FR-42 CA2, api-v1 E12)', () => {
	it('sin Bearer responde 401 UNAUTHENTICATED', async () => {
		const response = await send(baseUrl, '/api/v1/defaults', {
			host: apiHost,
			headers: appHeaders
		});

		expect(response.status).toBe(401);
		expect(codeOf(response.text)).toBe('UNAUTHENTICATED');
	});

	it('con un Bearer inventado responde 401 UNAUTHENTICATED', async () => {
		const response = await send(baseUrl, '/api/v1/defaults', {
			host: apiHost,
			headers: { ...appHeaders, authorization: 'Bearer inventado' }
		});

		expect(response.status).toBe(401);
	});

	it('con el Bearer de la app sigue respondiendo 200', async () => {
		const response = await send(baseUrl, '/api/v1/defaults', {
			host: apiHost,
			headers: { ...appHeaders, authorization: `Bearer ${token}` }
		});

		expect(response.status).toBe(200);
	});
});

describe('[C-29] orden de comprobaciones (api-v1 1.8: sesión antes que versión y que validación)', () => {
	it('GET /me sin Bearer y con versión antigua responde 401, no 426', async () => {
		const response = await send(baseUrl, '/api/v1/me', {
			host: apiHost,
			headers: { ...appHeaders, 'x-app-version': '3.0.0' }
		});

		expect(response.status).toBe(401);
		expect(codeOf(response.text)).toBe('UNAUTHENTICATED');
	});

	it('POST /me/accept-terms sin Bearer y con versión antigua responde 401, no 426', async () => {
		const response = await send(baseUrl, '/api/v1/me/accept-terms', {
			method: 'POST',
			host: apiHost,
			headers: { ...appHeaders, 'content-type': 'application/json', 'x-app-version': '3.0.0' },
			body: JSON.stringify({ documents: [{ document: 'terms', version: '1' }] })
		});

		expect(response.status).toBe(401);
	});

	it('POST /auth/logout sin Bearer y con cuerpo responde 401, no 400', async () => {
		const response = await send(baseUrl, '/api/v1/auth/logout', {
			method: 'POST',
			host: apiHost,
			headers: { ...appHeaders, 'content-type': 'application/json' },
			body: '{"x":1}'
		});

		expect(response.status).toBe(401);
		expect(codeOf(response.text)).toBe('UNAUTHENTICATED');
	});

	it('POST /auth/logout con app desconocida y cuerpo responde UNKNOWN_APP, no VALIDATION_ERROR', async () => {
		const response = await send(baseUrl, '/api/v1/auth/logout', {
			method: 'POST',
			host: apiHost,
			headers: { ...appHeaders, 'x-app-id': 'no-existe', 'content-type': 'application/json' },
			body: '{"x":1}'
		});

		expect(codeOf(response.text)).toBe('UNKNOWN_APP');
	});
});

describe('[C-28] [BE-FR-70/CA2] E06 · la aceptación desde la API registra la app (BE-FR-70 CA2, data-model terms_acceptances.app_id)', () => {
	let saved: AcceptanceRow[] = [];

	beforeAll(() => {
		saved = snapshotAcceptances();
		replaceAcceptances([]);
	});

	afterAll(() => {
		replaceAcceptances(saved);
	});

	it('la fila de terms_acceptances lleva el app_id de secretario, no null', async () => {
		const version = currentVersion('terms');
		const response = await send(baseUrl, '/api/v1/me/accept-terms', {
			method: 'POST',
			host: apiHost,
			headers: {
				...appHeaders,
				'content-type': 'application/json',
				authorization: `Bearer ${token}`
			},
			body: JSON.stringify({ documents: [{ document: 'terms', version }] })
		});
		expect(response.status).toBe(204);

		const row = acceptanceAppId('terms', version);
		expect(isRecord(row)).toBe(true);
		if (!isRecord(row)) return;
		expect(row.expected).not.toBeNull();
		expect(row.appId).toBe(row.expected);
	});
});
