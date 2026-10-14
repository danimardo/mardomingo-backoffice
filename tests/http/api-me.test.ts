// E05 `GET /api/v1/me` contra el build (T136; BE-FR-49.7, BE-FR-63, BE-FR-70 CA1). Usa la cuenta de chat con token Bearer de la app
// `secretario`: devuelve la forma exacta de la cuenta y funciona con mantenimiento y con documentos pendientes.
import { describe, expect, inject, it } from 'vitest';
import { send } from './client';

const baseUrl = inject('httpBaseUrl');
const token = inject('httpChatToken');
const apiHost = new URL(baseUrl).host;

const headers = {
	accept: 'application/json',
	'x-app-id': 'secretario',
	'x-app-version': '4.0.0',
	authorization: `Bearer ${token}`
};

const getMe = (extra: Record<string, string> = {}) =>
	send(baseUrl, '/api/v1/me', { host: apiHost, headers: { ...headers, ...extra } });

describe('E05 · GET /api/v1/me', () => {
	it('devuelve la cuenta con la forma del contrato y sin caché', async () => {
		const result = await getMe();

		expect(result.status).toBe(200);
		expect(String(result.headers['cache-control'])).toContain('no-store');
		const body: unknown = JSON.parse(result.text);
		if (typeof body !== 'object' || body === null) throw new Error('la respuesta no es un objeto');
		expect(Object.keys(body).sort()).toStrictEqual(
			[
				'balance',
				'email',
				'hasRealPurchase',
				'lowBalanceThresholdMicro',
				'pendingAcceptances',
				'roles'
			].sort()
		);
		expect('email' in body && typeof body.email).toBe('string');
		expect('roles' in body && Array.isArray(body.roles)).toBe(true);
		expect('hasRealPurchase' in body && typeof body.hasRealPurchase).toBe('boolean');
		expect('pendingAcceptances' in body && Array.isArray(body.pendingAcceptances)).toBe(true);
		expect('balance' in body && typeof body.balance).toBe('object');
	});

	it('sin token responde 401 UNAUTHENTICATED', async () => {
		const result = await send(baseUrl, '/api/v1/me', {
			host: apiHost,
			headers: { accept: 'application/json', 'x-app-id': 'secretario', 'x-app-version': '4.0.0' }
		});

		expect(result.status).toBe(401);
		expect(result.text).toContain('UNAUTHENTICATED');
	});

	it('con una versión por debajo de la mínima responde 426 UPGRADE_REQUIRED', async () => {
		const result = await getMe({ 'x-app-version': '3.0.0' });

		expect(result.status).toBe(426);
		expect(result.text).toContain('UPGRADE_REQUIRED');
	});
});
