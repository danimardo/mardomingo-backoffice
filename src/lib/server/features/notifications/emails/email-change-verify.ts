// Email de confirmación de un cambio de email (BE-FR-66/CA1; T266). Lo envía a la dirección NUEVA; el enlace caduca a las 24 h.
import * as m from '$lib/paraglide/messages.js';
import { renderLayout, type EmailContent } from './layout';

export interface EmailChangeVerifyInput {
	readonly link: string;
	readonly supportEmail: string;
}

export function emailChangeVerifyEmail(input: EmailChangeVerifyInput): EmailContent {
	return renderLayout({
		subject: m.notifications_email_change_subject(),
		lead: m.notifications_email_change_body(),
		action: {
			label: m.notifications_email_change_action(),
			url: input.link,
			fallback: m.notifications_email_change_fallback()
		},
		appName: null,
		supportEmail: input.supportEmail
	});
}
