// Aviso de una versión legal informativa (BE-FR-70, decisión del propietario: correo a todos y aviso en el panel). Sin enlace: la
// persona entra en su panel para leer el documento.
import * as m from '$lib/paraglide/messages.js';
import { renderLayout, type EmailContent } from './layout';

export interface LegalUpdateEmailInput {
	readonly supportEmail: string;
}

export function legalUpdateEmail(input: LegalUpdateEmailInput): EmailContent {
	return renderLayout({
		subject: m.notifications_legal_update_subject(),
		lead: m.notifications_legal_update_body(),
		appName: null,
		supportEmail: input.supportEmail
	});
}
