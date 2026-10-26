// Aviso de caducidad del saldo gratuito (BE-FR-16, FR-026; T330): un correo unos días antes de que caduque una bolsa gratuita con
// saldo. Sin enlace: el saldo y su fecha se miran en el panel. Los días son un número entero, no datos personales.
import * as m from '$lib/paraglide/messages.js';
import { renderLayout, type EmailContent } from './layout';

export interface FreeExpiryWarningInput {
	readonly days: number;
	readonly supportEmail: string;
}

export function freeExpiryWarningEmail(input: FreeExpiryWarningInput): EmailContent {
	return renderLayout({
		subject: m.notifications_free_expiry_subject(),
		lead: m.notifications_free_expiry_body({ days: String(input.days) }),
		appName: null,
		supportEmail: input.supportEmail
	});
}
