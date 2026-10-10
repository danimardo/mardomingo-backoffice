// Catálogo de eventos de infraestructura (constitución, principio XI; contracts/log-events.md 2.1–2.2 y 2.4).
// Cada código solo admite los campos de su firma, y `msg` sale de este catálogo (nunca se construye con datos).
// Cada funcionalidad aporta su catálogo en `src/lib/server/features/<f>/events.ts` y lo une aquí con una
// línea en `LogEventFieldMap` y otra en `LOG_EVENTS`.
import type { ErrorCode } from '$lib/server/shared/errors';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug';

export interface InfraLogFields {
	'app.started': { count: number };
	'app.stopping': { reason: 'sigterm' | 'sigint' | 'idle' };
	'app.config.invalid': { count: number };
	'app.db.migrated': { count: number; durationMs: number };
	'app.db.migration_failed': { err: unknown };
	'http.request.completed': {
		route: string;
		method: string;
		httpStatus: number;
		durationMs: number;
		errorCode?: ErrorCode;
	};
	'http.request.failed': { route: string; method: string; httpStatus: number; err: unknown };
	'http.host.rejected': { reason: 'host_mismatch' };
	'http.origin.rejected': { reason: 'origin_missing' | 'origin_mismatch'; httpStatus: 403 };
	'http.cors.rejected': { reason: 'origin_not_allowed'; errorCode: 'ORIGIN_NOT_ALLOWED' };
	'client.error.reported': { route: string; version: string; count: number; err: unknown };
}

export const INFRA_LOG_EVENTS = {
	'app.started': { level: 'info', msg: 'Aplicación iniciada' },
	'app.stopping': { level: 'info', msg: 'Aplicación deteniéndose' },
	'app.config.invalid': { level: 'fatal', msg: 'Configuración de entorno inválida' },
	'app.db.migrated': { level: 'info', msg: 'Migraciones aplicadas' },
	'app.db.migration_failed': { level: 'fatal', msg: 'Migración fallida' },
	'http.request.completed': { level: 'info', msg: 'Petición completada', downgradable: true },
	'http.request.failed': { level: 'error', msg: 'Error inesperado en la petición' },
	'http.host.rejected': { level: 'debug', msg: 'Host no corresponde a la ruta' },
	'http.origin.rejected': { level: 'info', msg: 'Formulario rechazado por su origen' },
	'http.cors.rejected': { level: 'info', msg: 'Origen no permitido para la app' },
	'client.error.reported': { level: 'warn', msg: 'Error del navegador recibido' }
} as const satisfies Record<keyof InfraLogFields, LogEventMeta>;

export interface LogEventMeta {
	readonly level: LogLevel;
	readonly msg: string;
	/** El nivel puede bajar a `debug` en casos concretos (p. ej. el healthcheck). */
	readonly downgradable?: true;
}

/** Unión de todos los catálogos de eventos. Cada funcionalidad añade su mapa aquí. */
export type LogEventFieldMap = InfraLogFields;

export type LogEventCode = keyof LogEventFieldMap;

export type LogEventFields<K extends LogEventCode> = LogEventFieldMap[K];

export type DowngradableLogEventCode = {
	[K in keyof typeof INFRA_LOG_EVENTS]: (typeof INFRA_LOG_EVENTS)[K] extends {
		readonly downgradable: true;
	}
		? K
		: never;
}[keyof typeof INFRA_LOG_EVENTS];

export const LOG_EVENTS: Readonly<Record<LogEventCode, LogEventMeta>> = {
	...INFRA_LOG_EVENTS
};
