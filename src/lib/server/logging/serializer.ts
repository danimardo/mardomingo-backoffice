// Serializador del campo `err` y lista de redacción (constitución, principio XI; Historias.md 15.19).
// El `message` nunca entra en el log: en errores de bibliotecas puede llevar datos del usuario o de la
// consulta. Solo se registran el nombre, el código y las líneas de la pila (las del tipo `at …`).
import { AppError } from '$lib/server/shared/errors';

/** Claves que se eliminan de cualquier registro, en el primer nivel y dentro de un objeto. */
export const LOG_REDACT_PATHS: readonly string[] = Object.freeze([
	'authorization',
	'cookie',
	'password',
	'token',
	'email',
	'idempotencyKey',
	'ip',
	'*.authorization',
	'*.cookie',
	'*.password',
	'*.token',
	'*.email',
	'*.idempotencyKey',
	'*.ip',
	'req.headers.authorization',
	'req.headers.cookie'
]);

export interface SerializedError {
	readonly type: string;
	readonly code?: string;
	readonly stack?: string;
}

/** Serializa `err`. Acepta un `Error` real o un objeto ya saneado (p. ej. el informe del navegador). */
export function serializeErr(value: unknown): SerializedError {
	if (value instanceof AppError) return build(value.name, value.code, undefined);
	if (value instanceof Error) {
		return build(value.name, codeOf(value), frameLines(value.stack));
	}
	if (isReportedError(value)) {
		return build(value.type, optionalText(value.code), optionalText(value.stack));
	}
	return { type: 'unknown' };
}

function build(type: string, code: string | undefined, stack: string | undefined): SerializedError {
	return {
		type,
		...(code === undefined ? {} : { code }),
		...(stack === undefined ? {} : { stack })
	};
}

function codeOf(error: Error): string | undefined {
	return 'code' in error && typeof error.code === 'string' ? error.code : undefined;
}

/** Solo las líneas `    at …`: la primera línea de `stack` repite el mensaje del error. */
function frameLines(stack: string | undefined): string | undefined {
	if (stack === undefined) return undefined;
	const frames = stack
		.split('\n')
		.filter((line) => /^\s+at\s/.test(line))
		.join('\n');
	return frames === '' ? undefined : frames;
}

interface ReportedError {
	readonly type: string;
	readonly code?: unknown;
	readonly stack?: unknown;
}

function isReportedError(value: unknown): value is ReportedError {
	return (
		typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string'
	);
}

function optionalText(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined;
}
