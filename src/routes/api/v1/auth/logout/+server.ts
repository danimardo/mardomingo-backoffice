// E04 · `POST /api/v1/auth/logout` (contracts/api-v1.md E04; BE-FR-06; T134). Sin cuerpo; revoca solo la sesión de este
// token, con efecto inmediato. Nunca exige versión mínima de la app.
import { apiFallback, apiRoute } from '$lib/server/api/handler';
import { validationErrorResponse } from '$lib/server/api/errors';
import { bearerOnlyHeaders, requireAppSession } from '$lib/server/api/session';
import { getComposition } from '$lib/server/composition.cache';

export const POST = apiRoute(async (event) => {
	const body = await event.request.text();
	if (body.trim() !== '') return validationErrorResponse('body');

	requireAppSession(event);
	await getComposition().accounts.logout(bearerOnlyHeaders(event.request.headers));
	return new Response(null, { status: 204 });
});

export const fallback = apiFallback(['POST']);
