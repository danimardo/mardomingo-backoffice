// Aviso de seguridad tras un cambio de contraseña (BE-FR-05): sin enlace, con el soporte por si no fue el usuario.
import * as m from '$lib/paraglide/messages.js';
import { renderLayout, type EmailContent } from './layout';

export interface PasswordChangedEmailInput {
	readonly supportEmail: string;
}

export function passwordChangedEmail(input: PasswordChangedEmailInput): EmailContent {
	return renderLayout({
		subject: m.notifications_password_changed_subject(),
		lead: m.notifications_password_changed_body(),
		appName: null,
		supportEmail: input.supportEmail
	});
}
