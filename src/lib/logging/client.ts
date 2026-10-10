// Único importador de `loglevel` (constitución, principio XI). Aquí viven también la huella de los errores y
// el envío del informe a `/client-errors`, sin mensaje y con la pila sin query.
import log from 'loglevel';
import type { ClientErrorReport } from '$lib/schemas/client-error-report';
import { CLIENT_LOG_EVENTS, type ClientLogEventCode, type ClientLogFields } from './events';

/** Niveles de la configuración (`CLIENT_LOG_LEVEL`). `fatal` no existe en loglevel: se trata como `error`. */
export type ClientLogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';

/** Fija el nivel de la consola. No se persiste en el navegador (`persist = false`). */
export function setClientLogLevel(level: ClientLogLevel): void {
	log.setLevel(level === 'fatal' ? 'error' : level, false);
}

export function emitClientEvent<K extends ClientLogEventCode>(
	event: K,
	fields: ClientLogFields[K]
): void {
	const meta = CLIENT_LOG_EVENTS[event];
	log[meta.level]({ event, msg: meta.msg, ...fields });
}

const MAX_FRAMES = 20;
const MAX_FRAME_LENGTH = 300;

/** Nombre y líneas de la pila de un error. El mensaje queda fuera a propósito. */
export function describeError(error: unknown): { name: string; frames: string[] } {
	if (error instanceof Error) {
		return { name: error.name.slice(0, 100) || 'Error', frames: framesOf(error.stack) };
	}
	return { name: 'NonError', frames: [] };
}

/** Solo las líneas `at …`, sin query de las URL del bundle y acotadas en número y longitud. */
export function framesOf(stack: string | undefined): string[] {
	if (stack === undefined) return [];
	return stack
		.split('\n')
		.filter((line) => /^\s*at\s/.test(line))
		.slice(0, MAX_FRAMES)
		.map((line) =>
			line
				.replace(/\?[^:)\s]*/g, '')
				.trim()
				.slice(0, MAX_FRAME_LENGTH)
		);
}

/** Huella corta y estable (FNV-1a de 32 bits) del nombre y la primera línea de la pila. */
export function fingerprintOf(name: string, frames: readonly string[]): string {
	const source = `${name}\n${frames[0] ?? ''}`;
	let hash = 0x811c9dc5;
	for (let index = 0; index < source.length; index += 1) {
		hash ^= source.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Envía el informe con `sendBeacon`: no espera respuesta ni bloquea la descarga de la página. */
export function sendClientErrorReport(report: ClientErrorReport): void {
	const body = new Blob([JSON.stringify(report)], { type: 'application/json' });
	const queued = navigator.sendBeacon('/client-errors', body);
	if (!queued) emitClientEvent('client.report.failed', { reason: 'network' });
}
