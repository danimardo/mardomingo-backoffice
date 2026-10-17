// Catálogo de eventos de la funcionalidad `audit` (contracts/log-events.md 1.1): prefijo `audit`, el nombre de la
// funcionalidad. Se une a `LOG_EVENTS` desde `logging/events.ts` a través de `audit/index.ts`.
import type { LogEventMeta } from '$lib/server/logging/events';

export interface AuditLogFields {
	'audit.entry.recorded': { action: string; entity: string };
}

export const AUDIT_LOG_EVENTS = Object.freeze({
	'audit.entry.recorded': { level: 'info', msg: 'Acción de administrador registrada' }
} as const satisfies Record<keyof AuditLogFields, LogEventMeta>);
