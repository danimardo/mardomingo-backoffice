// Aviso a la dirección ACTUAL cuando se pide un cambio de email (BE-FR-66; C-15). Sin enlace ni la dirección nueva, con el soporte.
import * as m from '$lib/paraglide/messages.js';
import { renderLayout, type EmailContent } from './layout';

export interface EmailChangeRequestedNoticeInput {
	readonly supportEmail: string;
}

export function emailChangeRequestedNoticeEmail(
	input: EmailChangeRequestedNoticeInput
): EmailContent {
	return renderLayout({
		subject: m.notifications_email_change_requested_subject(),
		lead: m.notifications_email_change_requested_body(),
		appName: null,
		supportEmail: input.supportEmail
	});
}
