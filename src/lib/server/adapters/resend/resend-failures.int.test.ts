// Fallos de envío de Resend contra el simulador (L14; T329): un 429 por límite o por cuota devuelve solo su código, sin el
// mensaje del proveedor, y se hace un único intento: no hay reintento infinito.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startResendMock } from '../../../../../tests/mock-servers/resend';
import type { MockServer } from '../../../../../tests/mock-servers/server';
import { createResendSender } from './resend-sender';

const EMAIL = {
	to: 'persona@ejemplo.es',
	subject: 'Confirma tu email',
	text: 'Enlace: https://cuenta.mardomingo.com/verificar',
	html: '<p>Enlace</p>',
	replyTo: 'soporte@mardomingo.com',
	idempotencyKey: 'verification-429'
};

let mock: MockServer;

beforeAll(async () => {
	mock = await startResendMock();
});

afterAll(async () => {
	await mock.close();
});

describe('fallos de envío de Resend (T329)', () => {
	it('un límite de peticiones devuelve solo su código, sin mensaje ni destinatario, en un único intento', async () => {
		mock.scenario('rate_limited');
		const sender = createResendSender({
			apiKey: 're_test',
			from: 'no-reply@mardomingo.com',
			baseUrl: mock.url
		});
		const before = mock.requests.length;

		const result = await sender.send(EMAIL);

		expect(result).toEqual({ ok: false, errorCode: 'rate_limit_exceeded' });
		expect(JSON.stringify(result)).not.toContain('Simulación');
		expect(JSON.stringify(result)).not.toContain('persona@ejemplo.es');
		expect(mock.requests.length - before).toBe(1);
		mock.scenario('ok');
	});

	it('una cuota diaria agotada se devuelve con su propio código', async () => {
		mock.scenario('daily_quota');
		const sender = createResendSender({
			apiKey: 're_test',
			from: 'no-reply@mardomingo.com',
			baseUrl: mock.url
		});

		expect(await sender.send(EMAIL)).toEqual({ ok: false, errorCode: 'daily_quota_exceeded' });
		mock.scenario('ok');
	});
});
