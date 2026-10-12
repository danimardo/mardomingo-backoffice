// Sincronización contra el build (T221; BE-FR-39–42, D-19; api-v1 E10–E12). Usa la cuenta de chat (con documentos legales
// aceptados y app `secretario`). Las comprobaciones que cambian el estado de la app o de la cuenta se restauran al terminar:
// mantenimiento de la app y aceptaciones legales de la cuenta, que se quitan y se vuelven a insertar.
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

function parse(text: string): Record<string, unknown> {
	const parsed: unknown = JSON.parse(text);
	return isRecord(parsed) ? parsed : {};
}

function errorOf(text: string): { code: unknown; details: Record<string, unknown> } {
	const error = parse(text).error;
	if (!isRecord(error)) throw new Error('sin error en formato 7.1');
	return { code: error.code, details: isRecord(error.details) ? error.details : {} };
}

const get = (path = '/api/v1/sync', extra: Record<string, string> = {}) =>
	send(baseUrl, path, { host: apiHost, headers: { ...headers, ...extra } });

const put = (body: string, ifMatch: string | null) =>
	send(baseUrl, '/api/v1/sync', {
		method: 'PUT',
		host: apiHost,
		headers: ifMatch === null ? headers : { ...headers, 'if-match': ifMatch },
		body
	});

function revisionOf(text: string): number {
	const revision = parse(text).revision;
	if (typeof revision !== 'number') throw new Error('sin revisión');
	return revision;
}

function setMaintenance(active: boolean): void {
	const sqlite = new Database(databasePath);
	try {
		sqlite
			.prepare(
				"UPDATE apps SET maintenance_active = ?, maintenance_message = ? WHERE slug = 'secretario'"
			)
			.run(active ? 1 : 0, active ? 'Volvemos pronto' : '');
	} finally {
		sqlite.close();
	}
}

let savedAcceptances: Record<string, unknown>[] = [];

function removeAcceptances(): void {
	const sqlite = new Database(databasePath);
	try {
		savedAcceptances = sqlite
			.prepare('SELECT * FROM terms_acceptances WHERE user_id = ?')
			.all(CHAT_USER_ID)
			.filter(isRecord);
		sqlite.prepare('DELETE FROM terms_acceptances WHERE user_id = ?').run(CHAT_USER_ID);
	} finally {
		sqlite.close();
	}
}

function restoreAcceptances(): void {
	const sqlite = new Database(databasePath);
	try {
		for (const row of savedAcceptances) {
			const columns = Object.keys(row);
			sqlite
				.prepare(
					`INSERT INTO terms_acceptances (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`
				)
				.run(...Object.values(row));
		}
	} finally {
		sqlite.close();
	}
}

beforeAll(() => {
	setMaintenance(false);
});

afterAll(() => {
	setMaintenance(false);
	restoreAcceptances();
});

describe('GET /api/v1/sync (E10)', () => {
	it('el primer GET siembra el documento y devuelve revisión y datos', async () => {
		const result = await get();

		expect(result.status).toBe(200);
		expect(result.headers['cache-control']).toBe('private, no-store');
		const body = parse(result.text);
		expect(revisionOf(result.text)).toBeGreaterThanOrEqual(1);
		expect(isRecord(body.data)).toBe(true);
	});

	it('sin cabecera de versión responde 426 UPGRADE_REQUIRED', async () => {
		const result = await get('/api/v1/sync', { 'x-app-version': '3.0.0' });

		expect(result.status).toBe(426);
		expect(errorOf(result.text).code).toBe('UPGRADE_REQUIRED');
	});
});

describe('PUT /api/v1/sync con If-Match (E11, BE-FR-41)', () => {
	it('sustituye el documento con la revisión leída y devuelve la siguiente', async () => {
		const current = revisionOf((await get()).text);

		const written = await put(
			JSON.stringify({ data: { quickTexts: { value: ['uno'], updatedAt: 1000 } } }),
			String(current)
		);

		expect(written.status).toBe(200);
		expect(revisionOf(written.text)).toBe(current + 1);
	});

	it('con una revisión ya superada responde 412 SYNC_CONFLICT (V10)', async () => {
		const current = revisionOf((await get()).text);
		await put(
			JSON.stringify({ data: { quickTexts: { value: ['dos'], updatedAt: 1001 } } }),
			String(current)
		);

		const stale = await put(
			JSON.stringify({ data: { quickTexts: { value: ['tres'], updatedAt: 1002 } } }),
			String(current)
		);

		expect(stale.status).toBe(412);
		expect(errorOf(stale.text).code).toBe('SYNC_CONFLICT');
	});

	it('sin If-Match responde 400 VALIDATION_ERROR con field If-Match (D-19)', async () => {
		const result = await put(JSON.stringify({ data: {} }), null);

		expect(result.status).toBe(400);
		expect(errorOf(result.text)).toMatchObject({
			code: 'VALIDATION_ERROR',
			details: { field: 'If-Match' }
		});
	});

	it('un If-Match mal formado responde 400 igual que el ausente', async () => {
		const result = await put(JSON.stringify({ data: {} }), '3a');

		expect(result.status).toBe(400);
		expect(errorOf(result.text).details).toMatchObject({ field: 'If-Match' });
	});

	it('una categoría no declarada por la app responde 400 VALIDATION_ERROR', async () => {
		const current = revisionOf((await get()).text);

		const result = await put(
			JSON.stringify({ data: { inventada: { value: 1, updatedAt: 1 } } }),
			String(current)
		);

		expect(result.status).toBe(400);
		expect(errorOf(result.text).code).toBe('VALIDATION_ERROR');
	});

	it('un documento mayor que max_sync_doc_kb responde 413 PAYLOAD_TOO_LARGE', async () => {
		const current = revisionOf((await get()).text);
		const huge = JSON.stringify({
			data: { quickTexts: { value: 'x'.repeat(1_100_000), updatedAt: 1 } }
		});

		const result = await put(huge, String(current));

		expect(result.status).toBe(413);
		expect(errorOf(result.text).code).toBe('PAYLOAD_TOO_LARGE');
	});
});

describe('mantenimiento y predeterminados (BE-FR-47, BE-FR-42 CA2)', () => {
	it('con mantenimiento, /sync responde 503 y /defaults sigue respondiendo 200', async () => {
		setMaintenance(true);

		const sync = await get();
		const defaults = await send(baseUrl, '/api/v1/defaults', {
			host: apiHost,
			headers: { 'x-app-id': 'secretario', 'x-app-version': '4.0.0', accept: 'application/json' }
		});
		setMaintenance(false);

		expect(sync.status).toBe(503);
		expect(errorOf(sync.text).code).toBe('MAINTENANCE');
		expect(defaults.status).toBe(200);
		expect(isRecord(parse(defaults.text).data)).toBe(true);
	});
});

describe('documentos legales pendientes (BE-FR-70 CA1)', () => {
	it('sin aceptaciones vigentes, /sync responde 403 TERMS_ACCEPTANCE_REQUIRED y /defaults no se bloquea', async () => {
		removeAcceptances();

		const sync = await get();
		const defaults = await send(baseUrl, '/api/v1/defaults', {
			host: apiHost,
			headers: { 'x-app-id': 'secretario', 'x-app-version': '4.0.0', accept: 'application/json' }
		});

		expect(sync.status).toBe(403);
		expect(errorOf(sync.text).code).toBe('TERMS_ACCEPTANCE_REQUIRED');
		expect(defaults.status).toBe(200);
	});
});

describe('documento OpenAPI (api-v1)', () => {
	it('publica GET y PUT de /sync y GET de /defaults', async () => {
		const result = await send(baseUrl, '/api/v1/openapi.json', {
			host: apiHost,
			headers: { accept: 'application/json' }
		});

		expect(result.status).toBe(200);
		const paths = parse(result.text).paths;
		if (!isRecord(paths)) throw new Error('sin paths en el documento OpenAPI');
		const sync = paths['/sync'];
		const defaults = paths['/defaults'];
		if (!isRecord(sync) || !isRecord(defaults)) throw new Error('faltan /sync o /defaults');
		expect(Object.keys(sync).sort()).toEqual(['get', 'put']);
		expect(Object.keys(defaults)).toEqual(['get']);
	});
});
