// Aviso al administrador (Historias 5.13; SC-019; T151). Un único modelo para todas las alertas: el texto sale del tipo
// de alerta y el detalle (días, modelo o día) va en una sola variable, nunca datos de usuario.
import * as m from '$lib/paraglide/messages.js';
import { renderLayout, type EmailContent } from './layout';

export type AdminAlertKind = 'fx_stale' | 'model_retired' | 'model_price' | 'flagged_threshold';

export interface AdminAlertInput {
	readonly kind: AdminAlertKind;
	/** Días sin actualizar, modelo afectado o día del umbral. */
	readonly detail: string;
	readonly supportEmail: string;
}

export function adminAlertEmail(input: AdminAlertInput): EmailContent {
	const text = textOf(input.kind, input.detail);
	return renderLayout({
		subject: text.subject,
		lead: text.body,
		appName: null,
		supportEmail: input.supportEmail
	});
}

function textOf(
	kind: AdminAlertKind,
	detail: string
): { readonly subject: string; readonly body: string } {
	switch (kind) {
		case 'fx_stale':
			return {
				subject: m.notifications_alert_fx_stale_subject(),
				body: m.notifications_alert_fx_stale_body({ detail })
			};
		case 'model_retired':
			return {
				subject: m.notifications_alert_model_retired_subject(),
				body: m.notifications_alert_model_retired_body({ detail })
			};
		case 'model_price':
			return {
				subject: m.notifications_alert_model_price_subject(),
				body: m.notifications_alert_model_price_body({ detail })
			};
		case 'flagged_threshold':
			return {
				subject: m.notifications_alert_flagged_subject(),
				body: m.notifications_alert_flagged_body({ detail })
			};
	}
}
