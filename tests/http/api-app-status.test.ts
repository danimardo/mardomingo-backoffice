// `GET /api/v1/app/status` contra el build (api-v1 E01; BE-FR-48 CA2, FR-074; T194). Público con `X-App-Id`: sin Bearer y
// sin versión mínima (una versión antigua también recibe 200, con su versión mínima informada), y nunca bloqueado.
import { describe, expect, inject, it } from 'vitest';
import { send } from './client';

const baseUrl = inject('httpBaseUrl');
const apiHost = new URL(baseUrl).host;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function parse(text: string): Record<string, unknown> {
	const parsed: unknown = JSON.parse(text);
	return isRecord(parsed) ? parsed : {};
}

describe('GET /api/v1/app/status', () => {
	it('devuelve el estado de la app sin sesión y sin cabecera de versión, con no-store', async () => {
		const result = await send(baseUrl, '/api/v1/app/status', {
			host: apiHost,
			headers: { 'x-app-id': 'secretario', accept: 'application/json' }
		});

		expect(result.status).toBe(200);
		expect(result.headers['cache-control']).toBe('no-store');
		expect(parse(result.text)).toMatchObject({
			app: { id: 'secretario' },
			minAppVersion: '4.0.0',
			maintenance: { active: false },
			limits: { maxAudioSeconds: 300 },
			announcements: []
		});
	});

	it('una versión antigua no se bloquea: responde 200 con la versión mínima informada', async () => {
		const result = await send(baseUrl, '/api/v1/app/status', {
			host: apiHost,
			headers: { 'x-app-id': 'secretario', 'x-app-version': '1.0.0', accept: 'application/json' }
		});

		expect(result.status).toBe(200);
		expect(parse(result.text)).toMatchObject({ minAppVersion: '4.0.0' });
	});

	it('una query desconocida responde 400 VALIDATION_ERROR', async () => {
		const result = await send(baseUrl, '/api/v1/app/status?x=1', {
			host: apiHost,
			headers: { 'x-app-id': 'secretario', accept: 'application/json' }
		});

		expect(result.status).toBe(400);
		expect(parse(result.text)).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
	});

	it('sin X-App-Id responde 400 UNKNOWN_APP', async () => {
		const result = await send(baseUrl, '/api/v1/app/status', {
			host: apiHost,
			headers: { accept: 'application/json' }
		});

		expect(result.status).toBe(400);
		expect(parse(result.text)).toMatchObject({ error: { code: 'UNKNOWN_APP' } });
	});

	it('un método distinto de GET responde 405', async () => {
		const result = await send(baseUrl, '/api/v1/app/status', {
			method: 'POST',
			host: apiHost,
			headers: { 'x-app-id': 'secretario', accept: 'application/json' },
			body: ''
		});

		expect(result.status).toBe(405);
	});
});
