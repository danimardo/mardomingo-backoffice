// Logger de pruebas: acumula los eventos para comprobar `event`, `reason` y que no sale nada sensible
// (Historias.md 15.19). Implementa el puerto `Logger` real; no escribe en ningún sitio.
import { LOG_EVENTS, type LogEventCode } from '$lib/server/logging/events';
import type { LogContext, Logger } from '$lib/server/logging/logger';

export interface RecordedEvent {
	readonly event: LogEventCode;
	readonly level: string;
	readonly context: LogContext;
	readonly fields: object;
}

export interface FakeLogger extends Logger {
	readonly events: readonly RecordedEvent[];
}

export function createFakeLogger(context: LogContext = {}, sink: RecordedEvent[] = []): FakeLogger {
	return {
		events: sink,
		emit(event, fields, options) {
			const meta = LOG_EVENTS[event];
			sink.push({ event, level: options?.level ?? meta.level, context, fields });
		},
		child(extra) {
			return createFakeLogger({ ...context, ...extra }, sink);
		}
	};
}

/** Evento por código: útil para afirmar campos concretos sin depender del orden. */
export function eventsNamed(logger: FakeLogger, event: LogEventCode): RecordedEvent[] {
	return logger.events.filter((recorded) => recorded.event === event);
}
