// Envío real con el SDK de Resend contra su simulador por HTTP (T090; R12, R16). Los errores solo llevan el código
// corto del proveedor (`error.name`), nunca su mensaje.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startResendMock } from '../../../../../tests/mock-servers/resend';
import type { MockServer } from '../../../../../tests/mock-servers/server';
import { createResendSender } from './resend-sender';
import { withOutbox } from './outbox';
import { createFakeEmailSender } from './fake-sender';
import type { OutgoingEmail } from './email-sender';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let mock: MockServer;

beforeEach(async () => {
	mock = await startResendMock();
});

afterEach(async () => {
	await mock.close();
});

const EMAIL: OutgoingEmail = {
	to: 'juan@ejemplo.es',
	subject: 'Confirma tu email',
	text: 'Texto plano con el enlace https://cuenta.mardomingo.com/verificar?token=abc',
	html: '<p>Hola</p>',
	replyTo: 'soporte@mardomingo.com',
	idempotencyKey: 'verif-1'
};

function sender() {
	return createResendSender({
		apiKey: 're_clave_de_prueba',
		from: 'Cuenta Mardomingo <no-reply@mardomingo.com>',
		baseUrl: mock.url
	});
}

describe('envío real con Resend', () => {
	it('devuelve el id del proveedor y envía el destinatario, el asunto y el Reply-To', async () => {
		await expect(sender().send(EMAIL)).resolves.toEqual({ ok: true, providerId: 're_mock_1' });

		const body: unknown = JSON.parse(mock.requests[0]?.body ?? '{}');
		expect(body).toMatchObject({
			to: 'juan@ejemplo.es',
			subject: 'Confirma tu email',
			reply_to: 'soporte@mardomingo.com'
		});
	});

	it('un rechazo del proveedor se devuelve solo como su código, sin el mensaje', async () => {
		mock.scenario('rejected');
		const result = await sender().send(EMAIL);

		expect(result).toEqual({ ok: false, errorCode: 'validation_error' });
		expect(JSON.stringify(result)).not.toContain('Simulación');
	});

	it('si el proveedor cae, el resultado es un fallo con código, no una excepción', async () => {
		mock.scenario('down');
		await expect(sender().send(EMAIL)).resolves.toEqual({
			ok: false,
			errorCode: 'application_error'
		});
	});
});

describe('_outbox_ del entorno de test', () => {
	it('escribe cada email en .outbox antes de entregarlo al envío de debajo', async () => {
		const dir = mkdtempSync(join(tmpdir(), 'mdm-outbox-'));
		try {
			const inner = createFakeEmailSender();
			const outbox = withOutbox(inner, { dir, now: () => 1_792_879_200_000 });

			await outbox.send(EMAIL);

			const files = readdirSync(dir);
			expect(files).toHaveLength(1);
			expect(files[0]).toMatch(/^1792879200000-.+\.json$/);
			const saved: unknown = JSON.parse(readFileSync(join(dir, files[0] ?? ''), 'utf8'));
			expect(JSON.stringify(saved)).toContain('token=abc');
			expect(inner.sent).toHaveLength(1);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
