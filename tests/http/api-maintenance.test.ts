// Mantenimiento por app contra el build (V09; BE-FR-47, BE-FR-48 CA2; T195). La administración (W40) llega en L13, así que el
// estado se prepara escribiendo la fila de la app, que el servidor lee sin caché. Solo está sembrada `secretario`: el paso
// con otra app sembrada no se puede hacer aún. Se restaura siempre, también si una prueba falla.
import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { send } from './client';

const baseUrl = inject('httpBaseUrl');
const token = inject('httpChatToken');
const databasePath = inject('httpDatabasePath');
const apiHost = new URL(baseUrl).host;
const MESSAGE = 'Volvemos a las 18:00';

const headers = {
	'content-type': 'application/json',
	accept: 'application/json',
	'x-app-id': 'secretario',
	'x-app-version': '4.0.0',
	authorization: `Bearer ${token}`
};

function setMaintenance(active: boolean, message: string): void {
	const sqlite = new Database(databasePath);
	try {
		sqlite
			.prepare(
				"UPDATE apps SET maintenance_active = ?, maintenance_message = ? WHERE slug = 'secretario'"
			)
			.run(active ? 1 : 0, message);
	} finally {
		sqlite.close();
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function parse(text: string): Record<string, unknown> {
	const parsed: unknown = JSON.parse(text);
	return isRecord(parsed) ? parsed : {};
}

beforeAll(() => {
	setMaintenance(true, MESSAGE);
});

afterAll(() => {
	setMaintenance(false, '');
});

describe('mantenimiento de la app secretario (V09)', () => {
	it('POST /ai/chat responde 503 MAINTENANCE con el texto del administrador y no llama al proveedor', async () => {
		const result = await send(baseUrl, '/api/v1/ai/chat', {
			method: 'POST',
			host: apiHost,
			headers,
			body: JSON.stringify({ operation: 'improve', messages: [{ role: 'user', content: 'Hola' }] })
		});

		expect(result.status).toBe(503);
		expect(parse(result.text)).toMatchObject({ error: { code: 'MAINTENANCE', message: MESSAGE } });
	});

	it('GET /app/status sigue respondiendo 200 e informa del mantenimiento', async () => {
		const result = await send(baseUrl, '/api/v1/app/status', { host: apiHost, headers });

		expect(result.status).toBe(200);
		expect(parse(result.text)).toMatchObject({ maintenance: { active: true, message: MESSAGE } });
	});

	it('al desactivarlo, /app/status deja de informar mantenimiento', async () => {
		setMaintenance(false, '');

		const result = await send(baseUrl, '/api/v1/app/status', { host: apiHost, headers });

		expect(parse(result.text)).toMatchObject({ maintenance: { active: false } });
	});
});
