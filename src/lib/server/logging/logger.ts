// Puerto `Logger` de la aplicación. Es el único módulo que importa `pino` (constitución, principio XI).
// Las capas reciben un `Logger` por parámetro; nunca importan pino ni escriben en consola.
import pino from 'pino';
import {
	LOG_EVENTS,
	type DowngradableLogEventCode,
	type LogEventCode,
	type LogEventFields,
	type LogLevel,
	type LogEventMeta
} from './events';
import { LOG_REDACT_PATHS, serializeErr } from './serializer';
import type { LogSink } from './outputs';

export const SERVICE_NAME = 'mardomingo_backoffice';

/** Umbral configurable (`LOG_LEVEL`): los niveles de emisión más `trace` y `silent`. */
export type LogThreshold = LogLevel | 'trace' | 'silent';

/** Campos de contexto que el logger hijo añade a todas sus líneas. */
export interface LogContext {
	readonly requestId?: string;
	readonly appId?: string;
	readonly userId?: string;
	readonly sessionId?: string;
	readonly route?: string;
	readonly method?: string;
	readonly task?: string;
}

export interface EmitOptions {
	readonly level?: 'debug';
}

export interface Logger {
	emit<K extends LogEventCode>(
		event: K,
		fields: LogEventFields<K>,
		options?: K extends DowngradableLogEventCode ? EmitOptions : never
	): void;
	child(context: LogContext): Logger;
}

export interface RootLoggerOptions {
	readonly level: LogThreshold;
	readonly env: string;
	readonly version: string;
	readonly sink: LogSink;
}

export function createRootLogger(options: RootLoggerOptions): Logger {
	const instance = pino(
		{
			level: options.level,
			messageKey: 'msg',
			timestamp: pino.stdTimeFunctions.isoTime,
			base: {
				schema: 1,
				service: SERVICE_NAME,
				env: options.env,
				version: options.version
			},
			formatters: {
				level: (label) => ({ level: label })
			},
			serializers: { err: serializeErr },
			redact: { paths: [...LOG_REDACT_PATHS], remove: true }
		},
		options.sink
	);
	return wrap(instance);
}

function wrap(instance: pino.Logger): Logger {
	return {
		emit(event, fields, options) {
			const meta = LOG_EVENTS[event];
			instance[levelOf(meta, options)](withEvent(event, fields), meta.msg);
		},
		child(context) {
			return wrap(instance.child(context));
		}
	};
}

/** Une el código del evento con sus campos. Los campos ya están tipados por el catálogo. */
function withEvent(event: string, fields: object): object {
	return { event, ...fields };
}

function levelOf(meta: LogEventMeta, options: EmitOptions | undefined): LogLevel {
	return options?.level ?? meta.level;
}
