// Catálogo de eventos de `privacy` (contracts/log-events.md; T281, T284). Nunca llevan datos de la cuenta ni el contenido
// de la exportación: solo la duración y el motivo (Historias 15.19).
import type { LogEventMeta } from '$lib/server/logging/events';

export interface PrivacyLogFields {
	'privacy.export.generated': { durationMs: number };
	'privacy.account.deleted': { reason: 'user' | 'inactivity' };
	'privacy.account.deletion_rejected': { reason: 'wrong_password' | 'not_found' };
	'privacy.inactive.notified': { count: number };
	'privacy.inactive.cancelled': Record<string, never>;
	'privacy.retention.applied': {
		reason: 'sessions' | 'ai_operations' | 'registration_ip' | 'other';
		count: number;
	};
}

export const PRIVACY_LOG_EVENTS = Object.freeze({
	'privacy.export.generated': { level: 'info', msg: 'Exportación de datos generada' },
	'privacy.account.deleted': { level: 'info', msg: 'Cuenta borrada y anonimizada' },
	'privacy.account.deletion_rejected': { level: 'info', msg: 'Borrado de cuenta rechazado' },
	'privacy.inactive.notified': { level: 'info', msg: 'Avisos de inactividad enviados' },
	'privacy.inactive.cancelled': { level: 'info', msg: 'Borrado por inactividad cancelado' },
	'privacy.retention.applied': { level: 'info', msg: 'Plazos de retención aplicados' }
} as const satisfies Record<keyof PrivacyLogFields, LogEventMeta>);
