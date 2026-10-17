// Catálogo de eventos de la funcionalidad `payments` (T236). Los campos llevan motivos y referencias internas, nunca importes,
// emails ni datos fiscales (Historias 15.19).
import type { LogEventMeta } from '$lib/server/logging/events';

export interface PaymentsLogFields {
	'payments.purchase.completed': Record<string, never>;
	'payments.purchase.duplicate': Record<string, never>;
	'payments.purchase.failed': { reason: 'provider_unavailable' };
	'payments.webhook.duplicate': Record<string, never>;
	'payments.refund.applied': Record<string, never>;
	'payments.refund.rejected': {
		reason:
			| 'amount_not_positive'
			| 'amount_exceeds_paid'
			| 'credits_exceed_bucket'
			| 'no_purchase_bucket';
	};
	'payments.chargeback.applied': Record<string, never>;
}

export const PAYMENTS_LOG_EVENTS = Object.freeze({
	'payments.purchase.completed': { level: 'info', msg: 'Compra completada y acreditada' },
	'payments.purchase.duplicate': {
		level: 'info',
		msg: 'Intento de compra repetido: no se acredita de nuevo'
	},
	'payments.purchase.failed': {
		level: 'warn',
		msg: 'Compra no iniciada: el proveedor no respondió'
	},
	'payments.webhook.duplicate': {
		level: 'info',
		msg: 'Evento de pago repetido: no se aplica otra vez'
	},
	'payments.refund.applied': { level: 'info', msg: 'Reembolso aplicado' },
	'payments.refund.rejected': { level: 'info', msg: 'Reembolso rechazado' },
	'payments.chargeback.applied': { level: 'warn', msg: 'Contracargo aplicado: cuenta bloqueada' }
} as const satisfies Record<keyof PaymentsLogFields, LogEventMeta>);
