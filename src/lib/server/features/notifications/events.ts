// Catálogo de eventos de la funcionalidad `notifications` (contracts/log-events.md 3.x): prefijo `notifications`.
// Los campos nunca llevan el destinatario, el asunto ni el enlace; solo el motivo y el código del proveedor.
import type { LogEventMeta } from '$lib/server/logging/events';

export type EmailReason =
	| 'verification'
	| 'password_reset'
	| 'password_changed'
	| 'admin_alert'
	| 'low_balance'
	| 'free_expiry_warning'
	| 'email_change_verify'
	| 'email_changed_notice'
	| 'legal_update'
	| 'inactivity_notice';

/** Tipo de alerta al administrador, sin la clave (que puede llevar ids de usuario). */
export type AlertType =
	| 'fx_stale'
	| 'model_retired'
	| 'model_price'
	| 'flagged_threshold'
	| 'global_brake'
	| 'ledger_mismatch'
	| 'openrouter_balance_low'
	| 'mistral_billing_error';

export interface NotificationsLogFields {
	'notifications.email.sent': { reason: EmailReason };
	'notifications.email.failed': { reason: EmailReason; provider: string; errorCode: string };
	'notifications.alert.triggered': { type: AlertType };
	'notifications.alert.suppressed': { type: AlertType };
	'notifications.alert.rearmed': { type: AlertType };
}

export const NOTIFICATIONS_LOG_EVENTS = Object.freeze({
	'notifications.email.sent': { level: 'info', msg: 'Email enviado' },
	'notifications.email.failed': { level: 'warn', msg: 'Email no enviado' },
	'notifications.alert.triggered': { level: 'warn', msg: 'Alerta al administrador disparada' },
	'notifications.alert.suppressed': { level: 'debug', msg: 'Alerta ya activa: no se repite' },
	'notifications.alert.rearmed': {
		level: 'info',
		msg: 'Alerta rearmada: la condición se ha normalizado'
	}
} as const satisfies Record<keyof NotificationsLogFields, LogEventMeta>);
