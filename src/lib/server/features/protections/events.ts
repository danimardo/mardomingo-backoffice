// Catálogo de eventos de `protections` (contracts/log-events.md; T191, T202). Sin textos del administrador ni datos de la
// app, y nunca importes ni saldos.
import type { LogEventMeta } from '$lib/server/logging/events';

export interface ProtectionsLogFields {
	'protections.request.rejected': {
		reason:
			| 'maintenance_global'
			| 'maintenance_app'
			| 'upgrade_required'
			| 'rate_limited_account'
			| 'rate_limited_app'
			| 'concurrency_account'
			| 'concurrency_app'
			| 'brake_active';
	};
	'protections.brake.activated': Record<string, never>;
	'protections.brake.alert_failed': Record<string, never>;
	'protections.brake.released': { reason: 'manual' | 'new_day' };
}

export const PROTECTIONS_LOG_EVENTS = Object.freeze({
	'protections.request.rejected': {
		level: 'info',
		msg: 'Petición rechazada por mantenimiento, versión mínima, freno, frecuencia o concurrencia'
	},
	'protections.brake.activated': {
		level: 'warn',
		msg: 'Freno global de gasto activado: el coste de las cuentas sin compras supera el límite del día'
	},
	'protections.brake.alert_failed': {
		level: 'error',
		msg: 'No se pudo enviar el aviso del freno global al administrador'
	},
	'protections.brake.released': {
		level: 'info',
		msg: 'Freno global de gasto liberado manualmente'
	}
} as const satisfies Record<keyof ProtectionsLogFields, LogEventMeta>);
