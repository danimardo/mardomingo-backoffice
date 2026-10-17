// Catálogo de eventos de `sync` (contracts/log-events.md; T217). Nunca lleva el contenido del documento ni de los
// predeterminados: solo motivos y contadores (Historias 15.19).
import type { LogEventMeta } from '$lib/server/logging/events';

export interface SyncLogFields {
	'sync.document.seeded': Record<string, never>;
	'sync.document.rejected': { reason: 'revision_conflict' | 'validation' | 'too_large' };
	'sync.document.corrupt': Record<string, never>;
	'sync.defaults.updated': Record<string, never>;
	'sync.defaults.copied': Record<string, never>;
}

export const SYNC_LOG_EVENTS = Object.freeze({
	'sync.document.seeded': {
		level: 'info',
		msg: 'Documento de sincronización sembrado con los predeterminados'
	},
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
	}
} as const satisfies Record<keyof SyncLogFields, LogEventMeta>);
