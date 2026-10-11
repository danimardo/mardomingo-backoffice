// Sesión de la API (BE-FR-03, BE-FR-65 CA3; T132). La API autentica con `Authorization: Bearer` y nunca con cookies:
// `hooks.server.ts` ya deja `locals.user` y `locals.session` sin cookie, y cada ruta protegida la exige con
// `requireAppSession`, que además comprueba que la sesión sea de la app de `X-App-Id`.
import { getComposition } from '$lib/server/composition.cache';
import { AppError } from '$lib/server/shared/errors';
import type { ApiEvent } from './handler';

/**
 * App de la petición, o el error de API correspondiente (`UNKNOWN_APP` o `APP_DISABLED`, BE-FR-62 CA1–CA2). Lo llama cada
 * ruta que necesita la app; las rutas inexistentes no llegan aquí y siguen dando `404 NOT_FOUND`.
 */
export function requireApp(event: ApiEvent): NonNullable<ApiEvent['locals']['app']> {
	const app = event.locals.app;
	if (app !== null) return app;
	const reason = event.locals.appRejection ?? 'unknown_app';
	event.locals.log.emit('apps.app.rejected', { reason });
	throw new AppError(reason === 'app_disabled' ? 'APP_DISABLED' : 'UNKNOWN_APP');
}

/** Cabeceras para leer la sesión de la API: sin `cookie`, así una cookie de la web nunca autentica aquí. */
export function bearerOnlyHeaders(headers: Headers): Headers {
	const copy = new Headers(headers);
	copy.delete('cookie');
	return copy;
}

/**
 * Exige una sesión de la app de la petición. Sin sesión, la respuesta es `401` y el motivo queda en el log. Better Auth
 * no distingue una sesión caducada de una revocada: con Bearer y sin sesión se registra como `expired`.
 */
export function requireAppSession(event: ApiEvent): {
	readonly sessionId: string;
	readonly userId: string;
	readonly appId: string;
} {
	const { locals, request } = event;
	requireApp(event);
	const session = locals.session;
	const user = locals.user;
	const app = locals.app;
	if (session === null || user === null || app === null) {
		const bearer = request.headers.has('authorization');
		locals.log.emit('accounts.session.rejected', {
			reason: bearer ? 'expired' : 'missing_token',
			errorCode: 'UNAUTHENTICATED'
		});
		throw new AppError('UNAUTHENTICATED');
	}
	if (session.appId !== app.id) {
		locals.log.emit('accounts.session.rejected', {
			reason: 'other_app',
			errorCode: 'UNAUTHENTICATED'
		});
		throw new AppError('UNAUTHENTICATED');
	}
	const scope = { sessionId: session.id, userId: user.id, appId: app.id };
	getComposition().accounts.touchAppSession(scope);
	return scope;
}
