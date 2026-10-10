// Adaptador de Turnstile contra su simulador por HTTP real (T089; BE-FR-01 CA3).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startTurnstileMock } from '../../../../../tests/mock-servers/turnstile';
import type { MockServer } from '../../../../../tests/mock-servers/server';
import { createTurnstileVerifier } from './turnstile-verifier';

let mock: MockServer;

beforeEach(async () => {
	mock = await startTurnstileMock();
});

afterEach(async () => {
	await mock.close();
});

function verifier() {
	return createTurnstileVerifier({ secret: 'secreto-de-prueba', endpoint: mock.url });
}

const CHECK = { token: 'token-del-widget', remoteIp: '203.0.113.7', idempotencyKey: 'intento-1' };

describe('verificación de Turnstile', () => {
	it('un token válido da «valid» y envía secreto, token, IP y clave de idempotencia', async () => {
		await expect(verifier().verify(CHECK)).resolves.toBe('valid');

		const [request] = mock.requests;
		expect(request?.path).toBe('/turnstile/v0/siteverify');
		expect(JSON.parse(request?.body ?? '{}')).toEqual({
			secret: 'secreto-de-prueba',
			response: 'token-del-widget',
			remoteip: '203.0.113.7',
			idempotency_key: 'intento-1'
		});
	});

	it('un token rechazado da «invalid»', async () => {
		mock.scenario('invalid');
		await expect(verifier().verify(CHECK)).resolves.toBe('invalid');
	});

	it('si el servicio cae o responde algo que no encaja, da «unavailable» (y se puede reintentar)', async () => {
		mock.scenario('down');
		await expect(verifier().verify(CHECK)).resolves.toBe('unavailable');
		mock.scenario('broken');
		await expect(verifier().verify(CHECK)).resolves.toBe('unavailable');
	});

	it('si no responde a tiempo, da «unavailable»', async () => {
		const slow = createTurnstileVerifier({
			secret: 's',
			endpoint: 'http://127.0.0.1:9',
			timeoutMs: 200
		});
		await expect(slow.verify(CHECK)).resolves.toBe('unavailable');
	});

	it('sin token no hace ninguna petición: es un formulario sin captcha', async () => {
		await expect(verifier().verify({ ...CHECK, token: '' })).resolves.toBe('invalid');
		expect(mock.requests).toHaveLength(0);
	});
});
