// Catálogo de eventos de infraestructura (constitución, principio XI; contracts/log-events.md 2.1–2.2 y 2.4).
// Cada código solo admite los campos de su firma, y `msg` sale de este catálogo (nunca se construye con datos).
// Cada funcionalidad aporta su catálogo en `src/lib/server/features/<f>/events.ts`, lo exporta desde su `index.ts`
// y lo une aquí con una línea en `LogEventFieldMap` y otra en `LOG_EVENTS`.
import type { ErrorCode } from '$lib/server/shared/errors';
import { AUDIT_LOG_EVENTS, type AuditLogFields } from '$lib/server/features/audit';
import { APPS_LOG_EVENTS, type AppsLogFields } from '$lib/server/features/apps';
import { ACCOUNTS_LOG_EVENTS, type AccountsLogFields } from '$lib/server/features/accounts';
import { LEGAL_LOG_EVENTS, type LegalLogFields } from '$lib/server/features/legal';
import { CREDITS_LOG_EVENTS, type CreditsLogFields } from '$lib/server/features/credits';
import { PRICING_LOG_EVENTS, type PricingLogFields } from '$lib/server/features/pricing';
import { AI_LOG_EVENTS, type AiLogFields } from '$lib/server/features/ai';
import {
	PROTECTIONS_LOG_EVENTS,
	type ProtectionsLogFields
} from '$lib/server/features/protections';
import { SYNC_LOG_EVENTS, type SyncLogFields } from '$lib/server/features/sync';
import { INVOICING_LOG_EVENTS, type InvoicingLogFields } from '$lib/server/features/invoicing';
import { PAYMENTS_LOG_EVENTS, type PaymentsLogFields } from '$lib/server/features/payments';
import { PRIVACY_LOG_EVENTS, type PrivacyLogFields } from '$lib/server/features/privacy';
import { STATS_LOG_EVENTS, type StatsLogFields } from '$lib/server/features/stats';
import {
	NOTIFICATIONS_LOG_EVENTS,
	type NotificationsLogFields
} from '$lib/server/features/notifications';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug';

export interface InfraLogFields {
	'app.started': { count: number };
	'app.stopping': { reason: 'sigterm' | 'sigint' | 'idle' };
	'app.config.invalid': { count: number };
	'app.config.body_limit_incoherent': { maxAudioMb: number };
	'app.db.migrated': { count: number; durationMs: number };
	'app.db.migration_failed': { err: unknown };
	'app.db.seed_failed': { err: unknown };
	'app.task.started': { task: string };
	'app.task.completed': { task: string; durationMs: number; count: number };
	'app.task.failed': { task: string; durationMs: number; err: unknown };
	'app.task.overlapped': { task: string };
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

export const INFRA_LOG_EVENTS = Object.freeze({
	'app.started': { level: 'info', msg: 'Aplicación iniciada' },
	'app.stopping': { level: 'info', msg: 'Aplicación deteniéndose' },
	'app.config.invalid': { level: 'fatal', msg: 'Configuración de entorno inválida' },
	'app.config.body_limit_incoherent': {
		level: 'fatal',
		msg: 'BODY_SIZE_LIMIT no cubre el audio máximo de una app'
	},
	'app.db.migrated': { level: 'info', msg: 'Migraciones aplicadas' },
	'app.db.migration_failed': { level: 'fatal', msg: 'Migración fallida' },
	'app.db.seed_failed': { level: 'fatal', msg: 'Datos iniciales no aplicados' },
	'app.task.started': { level: 'debug', msg: 'Tarea iniciada' },
	'app.task.completed': { level: 'info', msg: 'Tarea completada' },
	'app.task.failed': { level: 'error', msg: 'Tarea fallida' },
	'app.task.overlapped': { level: 'debug', msg: 'Tarea omitida: la anterior sigue en marcha' },
	'http.request.completed': { level: 'info', msg: 'Petición completada', downgradable: true },
	'http.request.failed': { level: 'error', msg: 'Error inesperado en la petición' },
	'http.host.rejected': { level: 'debug', msg: 'Host no corresponde a la ruta' },
	'http.origin.rejected': { level: 'info', msg: 'Formulario rechazado por su origen' },
	'http.cors.rejected': { level: 'info', msg: 'Origen no permitido para la app' },
	'client.error.reported': { level: 'warn', msg: 'Error del navegador recibido' }
} as const satisfies Record<keyof InfraLogFields, LogEventMeta>);

export interface LogEventMeta {
	readonly level: LogLevel;
	readonly msg: string;
	/** El nivel puede bajar a `debug` en casos concretos (p. ej. el healthcheck). */
	readonly downgradable?: true;
}

/** Unión de todos los catálogos de eventos. Cada funcionalidad añade su mapa aquí. */
export type LogEventFieldMap = InfraLogFields &
	AuditLogFields &
	AppsLogFields &
	AccountsLogFields &
	LegalLogFields &
	NotificationsLogFields &
	CreditsLogFields &
	PricingLogFields &
	AiLogFields &
	ProtectionsLogFields &
	SyncLogFields &
	InvoicingLogFields &
	PaymentsLogFields &
	PrivacyLogFields &
	StatsLogFields;

export type LogEventCode = keyof LogEventFieldMap;

export type LogEventFields<K extends LogEventCode> = LogEventFieldMap[K];

export type DowngradableLogEventCode = {
	[K in keyof typeof INFRA_LOG_EVENTS]: (typeof INFRA_LOG_EVENTS)[K] extends {
		readonly downgradable: true;
	}
		? K
		: never;
}[keyof typeof INFRA_LOG_EVENTS];

export const LOG_EVENTS: Readonly<Record<LogEventCode, LogEventMeta>> = Object.freeze({
	...INFRA_LOG_EVENTS,
	...AUDIT_LOG_EVENTS,
	...APPS_LOG_EVENTS,
	...ACCOUNTS_LOG_EVENTS,
	...LEGAL_LOG_EVENTS,
	...NOTIFICATIONS_LOG_EVENTS,
	...AI_LOG_EVENTS,
	...PROTECTIONS_LOG_EVENTS,
	...CREDITS_LOG_EVENTS,
	...PRICING_LOG_EVENTS,
	...SYNC_LOG_EVENTS,
	...INVOICING_LOG_EVENTS,
	...PAYMENTS_LOG_EVENTS,
	...PRIVACY_LOG_EVENTS,
	...STATS_LOG_EVENTS
});
