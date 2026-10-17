// Aviso a la dirección ANTERIOR cuando el cambio de email se aplica (BE-FR-66/CA3; T266). Sin enlace, con el soporte.
import * as m from '$lib/paraglide/messages.js';
import { renderLayout, type EmailContent } from './layout';

export interface EmailChangedNoticeInput {
	readonly supportEmail: string;
}

export function emailChangedNoticeEmail(input: EmailChangedNoticeInput): EmailContent {
	return renderLayout({
		subject: m.notifications_email_changed_subject(),
		lead: m.notifications_email_changed_body(),
		appName: null,
		supportEmail: input.supportEmail
	});
}
