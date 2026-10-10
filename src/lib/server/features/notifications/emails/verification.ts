// Email de verificación del alta (BE-FR-02, W09). El enlace lo construye `accounts` con su ruta propia y su token.
import * as m from '$lib/paraglide/messages.js';
import { renderLayout, type EmailContent } from './layout';

export interface VerificationEmailInput {
	readonly link: string;
	readonly appName: string | null;
	readonly supportEmail: string;
}

export function verificationEmail(input: VerificationEmailInput): EmailContent {
	return renderLayout({
		subject: m.notifications_verification_subject(),
		lead: m.notifications_verification_body(),
		action: {
			label: m.notifications_verification_action(),
			url: input.link,
			fallback: m.notifications_verification_fallback()
		},
		appName: input.appName,
		supportEmail: input.supportEmail
	});
}
