// Formateador de errores de la API: `{ error: { code, message, details } }` (contracts/api-v1.md 1.4).
// Solo sale un código del catálogo, el texto de Paraglide y `details` documentados. Nunca la entrada recibida.
import { AppError, ERROR_CODES, type ErrorCode } from '$lib/server/shared/errors';
import { ERROR_MESSAGES } from './error-messages';
import { jsonResponse } from './headers';

export interface ApiErrorBody {
	readonly error: {
		readonly code: ErrorCode;
		readonly message: string;
		readonly details: Readonly<Record<string, unknown>>;
	};
}

export interface ApiErrorOptions {
	readonly details?: Readonly<Record<string, unknown>>;
	/** Solo `MAINTENANCE` lo usa: el texto lo escribe el administrador (BE-FR-47). */
	readonly message?: string;
	readonly headers?: Readonly<Record<string, string>>;
}

export function apiErrorBody(code: ErrorCode, options: ApiErrorOptions = {}): ApiErrorBody {
	return {
		error: {
			code,
			message: options.message ?? ERROR_MESSAGES[code](),
			details: options.details ?? {}
		}
	};
}

export function apiErrorResponse(code: ErrorCode, options: ApiErrorOptions = {}): Response {
	return jsonResponse(apiErrorBody(code, options), {
		status: ERROR_CODES[code],
		headers: options.headers ?? {}
	});
}

/** Respuesta para un error tipado; los `details` del error pasan tal cual (los define quien lo lanza). */
export function appErrorResponse(error: AppError): Response {
	// `MAINTENANCE` lleva el texto que escribió el administrador (BE-FR-47); no se repite en los detalles.
	if (error.code === 'MAINTENANCE' && typeof error.details.message === 'string') {
		return apiErrorResponse(error.code, { message: error.details.message });
	}
	if (error.code === 'RATE_LIMITED' && typeof error.details.retryAfterSeconds === 'number') {
		return apiErrorResponse(error.code, {
			details: { retryAfterSeconds: error.details.retryAfterSeconds },
			headers: { 'Retry-After': String(error.details.retryAfterSeconds) }
		});
	}
	return apiErrorResponse(error.code, { details: error.details });
}

/** `VALIDATION_ERROR` con la ruta del primer campo inválido (`details.field`), nunca su valor. */
export function validationErrorResponse(field: string): Response {
	return apiErrorResponse('VALIDATION_ERROR', { details: { field } });
}
