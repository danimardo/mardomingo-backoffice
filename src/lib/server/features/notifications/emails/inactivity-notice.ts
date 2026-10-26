// Aviso de borrado por inactividad (BE-FR-86; T296): la cuenta lleva años sin actividad y se borrará pasado el plazo si no
// vuelve a entrar. El botón lleva al inicio de sesión: entrar es la actividad que cancela el borrado.
import * as m from '$lib/paraglide/messages.js';
import { renderLayout, type EmailContent } from './layout';

export interface InactivityNoticeEmailInput {
	readonly link: string;
	readonly years: number;
	readonly noticeDays: number;
	readonly supportEmail: string;
}

export function inactivityNoticeEmail(input: InactivityNoticeEmailInput): EmailContent {
	return renderLayout({
		subject: m.notifications_inactivity_subject(),
		lead: m.notifications_inactivity_body({
			years: String(input.years),
			days: String(input.noticeDays)
		}),
		action: {
			label: m.notifications_inactivity_action(),
			url: input.link,
			fallback: m.notifications_inactivity_fallback()
		},
		appName: null,
		supportEmail: input.supportEmail
	});
}
