// Catálogo de eventos de la funcionalidad `apps` (contracts/log-events.md 1.1): prefijo `apps`. Los campos nunca
// llevan valores de configuración ni contenido de plantillas, solo nombres de clave y de tabla.
import type { LogEventMeta } from '$lib/server/logging/events';

export interface AppsLogFields {
	'apps.settings.updated': { key: string; scope: 'global' | 'app' };
	'apps.settings.rejected': {
		key: string;
		scope: 'global' | 'app';
		reason: 'validation' | 'ceiling';
	};
	'apps.app.rejected': { reason: 'unknown_app' | 'app_disabled' };
	'apps.config.corrupt': { table: string; field: string };
	'apps.template.versioned': { version: number };
	'apps.announcement.created': Record<string, never>;
	'apps.announcement.deactivated': Record<string, never>;
	'apps.operation.activated': Record<string, never>;
	'apps.operation.activation_rejected': {
		reason: 'no_model' | 'model_unknown' | 'model_incapable' | 'no_price';
	};
}

export const APPS_LOG_EVENTS = Object.freeze({
	'apps.announcement.created': { level: 'info', msg: 'Anuncio creado' },
	'apps.announcement.deactivated': { level: 'info', msg: 'Anuncio desactivado' },
	'apps.operation.activated': { level: 'info', msg: 'Operación de IA activada' },
	'apps.operation.activation_rejected': {
		level: 'info',
		msg: 'Activación de operación de IA rechazada por la comprobación del modelo'
	},
	'apps.settings.updated': { level: 'info', msg: 'Parámetro de configuración actualizado' },
	'apps.settings.rejected': {
		level: 'info',
		msg: 'Cambio de configuración rechazado por validación'
	},
	'apps.app.rejected': { level: 'info', msg: 'Petición rechazada por la app de X-App-Id' },
	'apps.config.corrupt': { level: 'error', msg: 'Columna de configuración no válida al leer' },
	'apps.template.versioned': { level: 'info', msg: 'Nueva versión de plantilla publicada' }
} as const satisfies Record<keyof AppsLogFields, LogEventMeta>);
