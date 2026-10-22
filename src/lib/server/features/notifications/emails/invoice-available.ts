// Aviso «Factura disponible» (Historias 5.13; T328). La plantilla existe, pero en la v4 no se envía: no hay cobros reales con
// factura emitida por el proveedor. Sin enlace: la factura se consulta en el panel.
import * as m from '$lib/paraglide/messages.js';
import { renderLayout, type EmailContent } from './layout';

export interface InvoiceAvailableInput {
	readonly supportEmail: string;
}

export function invoiceAvailableEmail(input: InvoiceAvailableInput): EmailContent {
	return renderLayout({
		subject: m.notifications_invoice_available_subject(),
		lead: m.notifications_invoice_available_body(),
		appName: null,
		supportEmail: input.supportEmail
	});
}
