// Catálogo de eventos de `sync` (contracts/log-events.md; T217, T338). Nunca lleva el contenido del documento ni de los
// predeterminados: solo motivos y contadores (Historias 15.19).
import type { LogEventMeta } from '$lib/server/logging/events';

export interface SyncLogFields {
	'sync.document.seeded': Record<string, never>;
	'sync.document.read': { durationMs: number };
	'sync.document.written': { durationMs: number };
	'sync.document.rejected': {
		reason: 'revision_conflict' | 'schema_invalid' | 'too_large' | 'if_match_invalid';
		errorCode: 'SYNC_CONFLICT' | 'VALIDATION_ERROR' | 'PAYLOAD_TOO_LARGE';
	};
	'sync.document.corrupt': Record<string, never>;
	'sync.defaults.updated': { count: number };
	'sync.defaults.copied': { count: number };
	'sync.tombstones.purged': { count: number };
}

export const SYNC_LOG_EVENTS = Object.freeze({
	'sync.document.seeded': {
		level: 'info',
		msg: 'Documento de sincronización sembrado con los predeterminados'
	},
	'sync.document.read': { level: 'debug', msg: 'Documento de sincronización leído' },
	'sync.document.written': { level: 'info', msg: 'Documento de sincronización escrito' },
	'sync.document.rejected': { level: 'info', msg: 'Escritura de sincronización rechazada' },
	'sync.document.corrupt': {
		level: 'error',
		msg: 'Documento de sincronización corrupto en la base de datos'
	},
	'sync.defaults.updated': {
		level: 'info',
		msg: 'Predeterminados de la app actualizados por el administrador'
	},
	'sync.defaults.copied': {
		level: 'info',
		msg: 'Datos copiados como predeterminados por el administrador'
	},
	'sync.tombstones.purged': {
		level: 'info',
		msg: 'Marcas de borrado caducadas eliminadas de los documentos de sincronización'
	}
} as const satisfies Record<keyof SyncLogFields, LogEventMeta>);
