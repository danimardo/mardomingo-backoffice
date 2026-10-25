// Envío de los emails de la cuenta (BE-FR-58): plantilla por motivo, clave de idempotencia, Reply-To de soporte y registro
// sin destinatario ni enlace. Un envío fallido no lanza: devuelve `false` y deja el evento.
import { describe, expect, it } from 'vitest';
import { createFakeEmailSender } from '$lib/server/adapters/resend/fake-sender';
import { createFakeLogger, eventsNamed } from '../../../../../tests/builders/fake-logger';
import { sendAccountEmail, type NotificationsDeps } from './service';

const SUPPORT = 'soporte@mardomingo.com';
const ADDRESS = 'juan@ejemplo.es';

function depsWith(): {
	deps: NotificationsDeps;
	sender: ReturnType<typeof createFakeEmailSender>;
	logger: ReturnType<typeof createFakeLogger>;
} {
	const sender = createFakeEmailSender();
	const logger = createFakeLogger();
	return { deps: { sender, logger, supportEmail: () => SUPPORT }, sender, logger };
}

describe('sendAccountEmail', () => {
	it('envía la verificación con su enlace, Reply-To de soporte y clave de idempotencia', async () => {
		const { deps, sender, logger } = depsWith();

		const sent = await sendAccountEmail(deps, {
			reason: 'verification',
			to: ADDRESS,
			link: 'https://cuenta.mardomingo.com/verificar?token=abc',
			appName: 'Secretario AI',
			idempotencyKey: 'verification-abc'
		});

		expect(sent).toBe(true);
		expect(sender.sent).toHaveLength(1);
		expect(sender.sent[0]).toMatchObject({
			to: ADDRESS,
			replyTo: SUPPORT,
			idempotencyKey: 'verification-abc'
		});
		expect(sender.sent[0]?.text).toContain('https://cuenta.mardomingo.com/verificar?token=abc');
		expect(eventsNamed(logger, 'notifications.email.sent')).toHaveLength(1);
	});

	it('sin enlace (aviso de cambio de contraseña) envía igual, sin enlace en el texto', async () => {
		const { deps, sender } = depsWith();

		const sent = await sendAccountEmail(deps, {
			reason: 'password_changed',
			to: ADDRESS,
			idempotencyKey: 'password-changed-1'
		});

		expect(sent).toBe(true);
		expect(sender.sent[0]?.to).toBe(ADDRESS);
	});

	it('la recuperación sin enlace no rompe el envío', async () => {
		const { deps, sender } = depsWith();

		const sent = await sendAccountEmail(deps, {
			reason: 'password_reset',
			to: ADDRESS,
			idempotencyKey: 'password-reset-1'
		});

		expect(sent).toBe(true);
		expect(sender.sent).toHaveLength(1);
	});

	it('si el proveedor rechaza el envío, devuelve false y lo registra sin destinatario', async () => {
		const { deps, sender, logger } = depsWith();
		sender.fail('rate_limit_exceeded');

		const sent = await sendAccountEmail(deps, {
			reason: 'verification',
			to: ADDRESS,
			link: 'https://cuenta.mardomingo.com/verificar?token=abc',
			idempotencyKey: 'verification-abc'
		});

		expect(sent).toBe(false);
		expect(sender.sent).toHaveLength(0);
		const failed = eventsNamed(logger, 'notifications.email.failed');
		expect(failed).toHaveLength(1);
		expect(JSON.stringify(failed)).toContain('rate_limit_exceeded');
		expect(JSON.stringify(logger)).not.toContain(ADDRESS);
	});

	it('[T329] un rechazo por validación se registra en error, y no en warn como los demás fallos', async () => {
		const { deps, sender, logger } = depsWith();
		sender.fail('validation_error');

		await sendAccountEmail(deps, {
			reason: 'verification',
			to: ADDRESS,
			link: 'https://cuenta.mardomingo.com/verificar?token=abc',
			idempotencyKey: 'verification-validation'
		});

		expect(eventsNamed(logger, 'notifications.email.rejected')).toHaveLength(1);
		expect(eventsNamed(logger, 'notifications.email.failed')).toHaveLength(0);
		expect(JSON.stringify(logger)).not.toContain(ADDRESS);
	});
});
