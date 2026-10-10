// Eventos del navegador (`client.*`; contracts/log-events.md 2.4). Se registran con `loglevel`, solo en la
// consola del navegador, y el mensaje de un error nunca se incluye (principio XI).

export interface ClientErrorFields {
	readonly route: string;
	readonly version: string;
	readonly err: { readonly type: string; readonly code: string; readonly stack: string };
}

export interface ClientLogFields {
	'client.error.uncaught': ClientErrorFields;
	'client.error.unhandled_rejection': ClientErrorFields;
	'client.report.failed': { readonly reason: 'network' | 'rejected' };
}

export const CLIENT_LOG_EVENTS = {
	'client.error.uncaught': { level: 'error', msg: 'Error no capturado en el navegador' },
	'client.error.unhandled_rejection': { level: 'error', msg: 'Promesa rechazada sin capturar' },
	'client.report.failed': { level: 'debug', msg: 'No se pudo enviar el informe de error' }
} as const satisfies Record<keyof ClientLogFields, { level: 'error' | 'debug'; msg: string }>;

export type ClientLogEventCode = keyof ClientLogFields;
