// Envío de los emails transaccionales de la cuenta (BE-FR-58; FR-098). Elige la plantilla por motivo, envía a través
// del puerto `EmailSender` con una clave de idempotencia (un reintento no duplica el email) y registra el resultado
// sin destinatario ni enlace. Un envío fallido no tumba la acción que lo pidió: devuelve `false` y se registra.
import type { EmailSender } from '$lib/server/adapters/resend/email-sender';
import type { Logger } from '$lib/server/logging/logger';
import { passwordChangedEmail } from './emails/password-changed';
import { legalUpdateEmail } from './emails/legal-update';
import { inactivityNoticeEmail } from './emails/inactivity-notice';
import { lowBalanceEmail } from './emails/low-balance';
import { freeExpiryWarningEmail } from './emails/free-expiry-warning';
import { invoiceAvailableEmail } from './emails/invoice-available';
import { emailChangeVerifyEmail } from './emails/email-change-verify';
import { emailChangedNoticeEmail } from './emails/email-changed-notice';
import { passwordResetEmail } from './emails/password-reset';
import { verificationEmail } from './emails/verification';
import type { EmailReason } from './events';

export interface NotificationsDeps {
	readonly sender: EmailSender;
	readonly logger: Logger;
	/** Email de soporte: va en el pie y como Reply-To (BE-FR-58). Se lee al enviar, no al componer. */
	readonly supportEmail: () => string;
}

export interface AccountEmail {
	readonly reason: EmailReason;
	readonly to: string;
	/** Enlace de verificación o de recuperación; no aplica al aviso de cambio de contraseña. */
	readonly link?: string;
	/** Años de inactividad y días de plazo del aviso de borrado (BE-FR-86). */
	readonly inactivity?: { readonly years: number; readonly noticeDays: number };
	/** Días que faltan para la caducidad del saldo gratuito (T330). */
	readonly expiry?: { readonly days: number };
	/** Nombre visible de la app, cuando el email se refiere a una (BE-FR-64 CA3). */
	readonly appName?: string;
	/** Clave de idempotencia: el mismo envío lógico lleva siempre la misma clave. */
	readonly idempotencyKey: string;
}

const PROVIDER = 'resend';

function contentOf(deps: NotificationsDeps, email: AccountEmail) {
	const supportEmail = deps.supportEmail();
	if (email.reason === 'verification') {
		return verificationEmail({
			link: email.link ?? '',
			appName: email.appName ?? null,
			supportEmail
		});
	}
	if (email.reason === 'password_reset') {
		return passwordResetEmail({ link: email.link ?? '', supportEmail });
	}
	if (email.reason === 'low_balance') return lowBalanceEmail({ supportEmail });
	if (email.reason === 'invoice_available') return invoiceAvailableEmail({ supportEmail });
	if (email.reason === 'free_expiry_warning') {
		return freeExpiryWarningEmail({ days: email.expiry?.days ?? 0, supportEmail });
	}
	if (email.reason === 'email_change_verify') {
		return emailChangeVerifyEmail({ link: email.link ?? '', supportEmail });
	}
	if (email.reason === 'email_changed_notice') return emailChangedNoticeEmail({ supportEmail });
	if (email.reason === 'legal_update') return legalUpdateEmail({ supportEmail });
	if (email.reason === 'inactivity_notice') {
		return inactivityNoticeEmail({
			link: email.link ?? '',
			years: email.inactivity?.years ?? 0,
			noticeDays: email.inactivity?.noticeDays ?? 0,
			supportEmail
		});
	}
	if (email.reason === 'password_changed') return passwordChangedEmail({ supportEmail });
	// Un motivo sin plantilla no debe salir con el texto de otro aviso: se falla en vez de enviar un email equivocado.
	throw new Error(`sin plantilla para el motivo ${email.reason}`);
}

/** Envía un email de la cuenta. Devuelve `true` si el proveedor lo aceptó. */
export async function sendAccountEmail(
	deps: NotificationsDeps,
	email: AccountEmail
): Promise<boolean> {
	const content = contentOf(deps, email);
	const result = await deps.sender.send({
		to: email.to,
		subject: content.subject,
		text: content.text,
		html: content.html,
		replyTo: deps.supportEmail(),
		idempotencyKey: email.idempotencyKey
	});
	if (result.ok) {
		deps.logger.emit('notifications.email.sent', { reason: email.reason });
		return true;
	}
	// Un rechazo por validación del proveedor es un error de nuestro lado (T329): va en su propio evento, a nivel error.
	const event =
		result.errorCode === 'validation_error'
			? 'notifications.email.rejected'
			: 'notifications.email.failed';
	deps.logger.emit(event, {
		reason: email.reason,
		provider: PROVIDER,
		errorCode: result.errorCode
	});
	return false;
}
