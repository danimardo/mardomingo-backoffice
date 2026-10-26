// Aceptación de US12 sobre el outbox simulado (BE-FR-58, UX-17; T343): cada disparador de la tabla 5.13 que tiene plantilla
// envía a su destinatario con asunto, pie con soporte, versión en texto plano y el enlace visible como texto. Ningún email lleva
// datos internos (ids, hashes, tokens internos o sesiones).
import { describe, expect, it } from 'vitest';
import { createFakeEmailSender } from '$lib/server/adapters/resend/fake-sender';
import { createFakeLogger } from '../../../../../tests/builders/fake-logger';
import { sendAccountEmail, type AccountEmail, type NotificationsDeps } from './service';

const SUPPORT = 'soporte@mardomingo.com';
const TO = 'persona@ejemplo.es';
const LINK = 'https://cuenta.mardomingo.com/verificar?token=abc123';

const TRIGGERS: readonly {
	readonly name: string;
	readonly email: AccountEmail;
	readonly link: boolean;
}[] = [
	{
		name: 'verificación',
		email: { reason: 'verification', to: TO, link: LINK, idempotencyKey: 'k1' },
		link: true
	},
	{
		name: 'recuperación',
		email: { reason: 'password_reset', to: TO, link: LINK, idempotencyKey: 'k2' },
		link: true
	},
	{
		name: 'contraseña cambiada',
		email: { reason: 'password_changed', to: TO, idempotencyKey: 'k3' },
		link: false
	},
	{
		name: 'cambio de email',
		email: { reason: 'email_change_verify', to: TO, link: LINK, idempotencyKey: 'k4' },
		link: true
	},
	{
		name: 'aviso de cambio de email',
		email: { reason: 'email_changed_notice', to: TO, idempotencyKey: 'k5' },
		link: false
	},
	{
		name: 'saldo bajo',
		email: { reason: 'low_balance', to: TO, idempotencyKey: 'k6' },
		link: false
	},
	{
		name: 'caducidad del saldo gratuito',
		email: { reason: 'free_expiry_warning', to: TO, expiry: { days: 7 }, idempotencyKey: 'k7' },
		link: false
	},
	{
		name: 'cambio legal',
		email: { reason: 'legal_update', to: TO, idempotencyKey: 'k8' },
		link: false
	},
	{
		name: 'inactividad',
		email: {
			reason: 'inactivity_notice',
			to: TO,
			link: LINK,
			inactivity: { years: 2, noticeDays: 30 },
			idempotencyKey: 'k9'
		},
		link: true
	}
];

describe('aceptación de US12 sobre el outbox (T343)', () => {
	for (const trigger of TRIGGERS) {
		it(`${trigger.name}: llega al destinatario con pie de soporte, texto plano y datos sin exponer`, async () => {
			const sender = createFakeEmailSender();
			const deps: NotificationsDeps = {
				sender,
				logger: createFakeLogger(),
				supportEmail: () => SUPPORT
			};

			expect(await sendAccountEmail(deps, trigger.email)).toBe(true);

			const [mail] = sender.sent;
			expect(sender.sent).toHaveLength(1);
			expect(mail?.to).toBe(TO);
			expect(mail?.replyTo).toBe(SUPPORT);
			expect(mail?.subject.length ?? 0).toBeGreaterThan(0);
			expect(mail?.text).toContain(SUPPORT);
			expect(mail?.text).toContain('Cuenta Mardomingo');
			if (trigger.link) {
				expect(mail?.text).toContain(LINK);
				expect(mail?.html).toContain(LINK.replace(/&/g, '&amp;'));
			}
			const everything = `${mail?.subject ?? ''}${mail?.text ?? ''}${mail?.html ?? ''}`;
			expect(everything).not.toContain(trigger.email.idempotencyKey);
			expect(everything).not.toMatch(/user_id|usr_|password_hash|session/i);
		});
	}
});
