// Aviso de saldo bajo (BE-FR-49.7): un correo al cruzar el umbral hacia abajo. Sin enlace; el saldo se mira en el panel.
import * as m from '$lib/paraglide/messages.js';
import { renderLayout, type EmailContent } from './layout';

export interface LowBalanceEmailInput {
	readonly supportEmail: string;
}

export function lowBalanceEmail(input: LowBalanceEmailInput): EmailContent {
	return renderLayout({
		subject: m.notifications_low_balance_subject(),
		lead: m.notifications_low_balance_body(),
		appName: null,
		supportEmail: input.supportEmail
	});
}
