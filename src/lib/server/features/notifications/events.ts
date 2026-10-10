// Catálogo de eventos de la funcionalidad `notifications` (contracts/log-events.md 3.x): prefijo `notifications`.
// Los campos nunca llevan el destinatario, el asunto ni el enlace; solo el motivo y el código del proveedor.
import type { LogEventMeta } from '$lib/server/logging/events';

export type EmailReason = 'verification' | 'password_reset' | 'password_changed';

export interface NotificationsLogFields {
	'notifications.email.sent': { reason: EmailReason };
	'notifications.email.failed': { reason: EmailReason; provider: string; errorCode: string };
}

export const NOTIFICATIONS_LOG_EVENTS = Object.freeze({
	'notifications.email.sent': { level: 'info', msg: 'Email enviado' },
	'notifications.email.failed': { level: 'warn', msg: 'Email no enviado' }
} as const satisfies Record<keyof NotificationsLogFields, LogEventMeta>);
