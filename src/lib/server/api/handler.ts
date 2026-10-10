// Envoltorio de los `+server.ts` de la API. Un error tipado se convierte en la respuesta 7.1; cualquier otro
// error se registra aquí, una sola vez (`http.request.failed`), y responde `500 INTERNAL_ERROR`. Así la
// API no cae en la página de error de SvelteKit y no hay doble registro con `handleError` (principio XI).
import type { RequestEvent } from '@sveltejs/kit';
import { AppError } from '$lib/server/shared/errors';
import { apiErrorResponse, appErrorResponse } from './errors';

/** Lo que usan los manejadores de la API. Un subconjunto de `RequestEvent` facilita probarlos sin el trazado. */
export type ApiEvent = Pick<
	RequestEvent,
	'request' | 'url' | 'route' | 'locals' | 'getClientAddress' | 'cookies'
>;

export type ApiHandler = (event: ApiEvent) => Promise<Response> | Response;

export function apiRoute(handler: ApiHandler): (event: ApiEvent) => Promise<Response> {
	return async (event) => {
		try {
			return await handler(event);
		} catch (error) {
			if (error instanceof AppError) return appErrorResponse(error);
			event.locals.log.emit('http.request.failed', {
				route: event.route.id ?? '',
				method: event.request.method,
				httpStatus: 500,
				err: error
			});
			return apiErrorResponse('INTERNAL_ERROR');
		}
	};
}

/** Respuesta de `fallback`: método no previsto por la ruta (`405` con `Allow`). */
export function apiFallback(allow: readonly string[]): (event: ApiEvent) => Response {
	return () => apiErrorResponse('METHOD_NOT_ALLOWED', { headers: { allow: allow.join(', ') } });
}
