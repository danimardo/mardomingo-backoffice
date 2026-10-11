// Catálogo de eventos de `protections` (contracts/log-events.md; T191). Sin textos del administrador ni datos de la app.
import type { LogEventMeta } from '$lib/server/logging/events';

export interface ProtectionsLogFields {
	'protections.request.rejected': {
		reason: 'maintenance_global' | 'maintenance_app' | 'upgrade_required';
	};
}

export const PROTECTIONS_LOG_EVENTS = Object.freeze({
	'protections.request.rejected': {
		level: 'info',
		msg: 'Petición rechazada por mantenimiento o versión mínima'
	}
} as const satisfies Record<keyof ProtectionsLogFields, LogEventMeta>);
