// Catálogo de eventos de `legal` (contracts/log-events.md 3.x): prefijo `legal`. Sin texto de los documentos ni IP.
import type { LogEventMeta } from '$lib/server/logging/events';

export interface LegalLogFields {
	'legal.acceptance.recorded': { count: number };
	'legal.acceptance.required': { count: number };
	'legal.acceptance.rejected': {
		reason: 'version_not_current';
		errorCode: 'LEGAL_VERSION_CHANGED';
	};
}

export const LEGAL_LOG_EVENTS = Object.freeze({
	'legal.acceptance.recorded': { level: 'info', msg: 'Aceptación legal registrada' },
	'legal.acceptance.required': {
		level: 'info',
		msg: 'Hay documentos legales pendientes de aceptar'
	},
	'legal.acceptance.rejected': { level: 'info', msg: 'Aceptación legal rechazada' }
} as const satisfies Record<keyof LegalLogFields, LogEventMeta>);
