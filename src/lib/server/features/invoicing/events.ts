// Catálogo de eventos de la funcionalidad `invoicing` (T238). Los campos llevan motivos y tipos, nunca nombres, NIF ni
// importes (Historias 15.19).
import type { LogEventMeta } from '$lib/server/logging/events';

export interface InvoicingLogFields {
	'invoicing.invoice.issued': { kind: 'simplified' | 'full' | 'corrective' };
	'invoicing.invoice.skipped': { reason: 'simulated' | 'provider_none' | 'not_issued' };
	'invoicing.invoice.duplicate': Record<string, never>;
	'invoicing.invoice.rejected': { reason: 'billing_profile_required' | 'original_not_found' };
	'invoicing.billing_profile.updated': Record<string, never>;
	'invoicing.billing_profile.rejected': { reason: 'validation' };
	'invoicing.export.generated': Record<string, never>;
}

export const INVOICING_LOG_EVENTS = Object.freeze({
	'invoicing.invoice.issued': { level: 'info', msg: 'Factura emitida' },
	'invoicing.invoice.skipped': { level: 'info', msg: 'Factura no emitida' },
	'invoicing.invoice.duplicate': { level: 'info', msg: 'Emisión repetida: la factura ya existe' },
	'invoicing.invoice.rejected': { level: 'warn', msg: 'Factura rechazada antes de emitir' },
	'invoicing.billing_profile.updated': { level: 'info', msg: 'Perfil fiscal guardado' },
	'invoicing.billing_profile.rejected': { level: 'info', msg: 'Perfil fiscal rechazado' },
	'invoicing.export.generated': { level: 'info', msg: 'Exportación contable generada' }
} as const satisfies Record<keyof InvoicingLogFields, LogEventMeta>);
