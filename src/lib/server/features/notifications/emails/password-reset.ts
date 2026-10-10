// Email de recuperación de contraseña (BE-FR-05, W13). Caduca en 1 hora y sirve una sola vez.
import * as m from '$lib/paraglide/messages.js';
import { renderLayout, type EmailContent } from './layout';

export interface PasswordResetEmailInput {
	readonly link: string;
	readonly supportEmail: string;
}

export function passwordResetEmail(input: PasswordResetEmailInput): EmailContent {
	return renderLayout({
		subject: m.notifications_reset_subject(),
		lead: m.notifications_reset_body(),
		action: {
			label: m.notifications_reset_action(),
			url: input.link,
			fallback: m.notifications_reset_fallback()
		},
		appName: null,
		supportEmail: input.supportEmail
	});
}
