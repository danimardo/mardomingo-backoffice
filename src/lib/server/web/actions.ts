// Helpers de las acciones web (contracts/web-routes.md 1.4): la IP del cliente y la traducción de un error de negocio a
// `fail` con su código del catálogo. Nunca viajan contraseñas ni tokens en la respuesta.
import { fail } from '@sveltejs/kit';
import { AppError } from '$lib/server/shared/errors';

/** IP del cliente (`event.getClientAddress()`); `null` si la plataforma no la puede dar (p. ej. en pruebas). */
export function clientIpOf(getClientAddress: () => string): string | null {
	try {
		return getClientAddress();
	} catch {
		return null;
	}
}

/** Error de negocio como `fail` con su código y, si lo hay, el tiempo de espera visible. */
export function failureOf(error: AppError, values: Readonly<Record<string, string>> = {}) {
	const retry = error.details.retryAfterMinutes;
	return fail(error.status, {
		formError: error.code,
		values,
		...(typeof retry === 'number' ? { retryAfterMinutes: retry } : {})
	});
}
