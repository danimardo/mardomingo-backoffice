// Caminos de error del adaptador de Resend que el simulador por HTTP no provoca: una excepción del SDK con nombre, una
// que no es un Error y la configuración sin o con `baseUrl`. El SDK se sustituye por un doble; lo que se prueba es la
// traducción del resultado, sin mensaje ni destinatario en los errores.
import { describe, expect, it, vi } from 'vitest';

const sendMock = vi.hoisted(() => vi.fn());
const constructorMock = vi.hoisted(() => vi.fn());

vi.mock('resend', () => ({
	Resend: class {
		readonly emails = { send: sendMock };

		constructor(...args: unknown[]) {
			constructorMock(...args);
		}
	}
}));

import { createResendSender } from './resend-sender';

const EMAIL = {
	to: 'juan@ejemplo.es',
	subject: 'Confirma tu email',
	text: 'Texto plano',
	html: '<p>Texto</p>',
	replyTo: 'soporte@mardomingo.com',
	idempotencyKey: 'verification-abc'
};

describe('createResendSender con excepciones del SDK', () => {
	it('envía con la clave de idempotencia en cada envío', async () => {
		sendMock.mockResolvedValueOnce({ data: { id: 'em_1' }, error: null });
		const sender = createResendSender({ apiKey: 're_test', from: 'no-reply@mardomingo.com' });

		await sender.send(EMAIL);

		expect(sendMock).toHaveBeenLastCalledWith(
			{
				from: 'no-reply@mardomingo.com',
				to: EMAIL.to,
				subject: EMAIL.subject,
				text: EMAIL.text,
				html: EMAIL.html,
				replyTo: EMAIL.replyTo
			},
			{ idempotencyKey: 'verification-abc' }
		);
	});

	it('un error de red con nombre se devuelve como su nombre, sin el mensaje', async () => {
		sendMock.mockRejectedValueOnce(new TypeError('fetch failed para juan@ejemplo.es'));
		const sender = createResendSender({ apiKey: 're_test', from: 'no-reply@mardomingo.com' });

		const result = await sender.send(EMAIL);

		expect(result).toEqual({ ok: false, errorCode: 'TypeError' });
		expect(JSON.stringify(result)).not.toContain('juan@ejemplo.es');
	});

	it('una excepción que no es un Error se devuelve como código genérico', async () => {
		sendMock.mockRejectedValueOnce('algo raro');
		const sender = createResendSender({ apiKey: 're_test', from: 'no-reply@mardomingo.com' });

		expect(await sender.send(EMAIL)).toEqual({ ok: false, errorCode: 'UnknownError' });
	});

	it('sin baseUrl usa el SDK por defecto; con baseUrl la pasa al SDK', () => {
		constructorMock.mockClear();

		createResendSender({ apiKey: 're_test', from: 'no-reply@mardomingo.com' });
		expect(constructorMock).toHaveBeenLastCalledWith('re_test', {});

		createResendSender({
			apiKey: 're_test',
			from: 'no-reply@mardomingo.com',
			baseUrl: 'http://127.0.0.1:7392'
		});
		expect(constructorMock).toHaveBeenLastCalledWith('re_test', {
			baseUrl: 'http://127.0.0.1:7392'
		});
	});
});
