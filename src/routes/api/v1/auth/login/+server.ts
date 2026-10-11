// E02 · `POST /api/v1/auth/login` (contracts/api-v1.md E02; BE-FR-03 CA2–CA3; T133). Requiere `X-App-Id`: el paso «app»
// de `hooks.server.ts` ya lo ha resuelto. Responde el token de la sesión, ligada a la app, el usuario y los documentos
// legales pendientes. La respuesta no se guarda en caché.
import { apiFallback, apiRoute } from '$lib/server/api/handler';
import { validationErrorResponse } from '$lib/server/api/errors';
import { requireApp } from '$lib/server/api/session';
import { jsonResponse } from '$lib/server/api/headers';
import { firstIssuePath, jsonBodyOf } from '$lib/server/api/body';
import { getComposition } from '$lib/server/composition.cache';
import { AppLoginBody } from '$lib/server/features/accounts';
import { clientIpOf } from '$lib/server/web/actions';

export const POST = apiRoute(async (event) => {
	const app = requireApp(event);
	const parsed = AppLoginBody.safeParse(await jsonBodyOf(event.request));
	if (!parsed.success) return validationErrorResponse(firstIssuePath(parsed.error.issues));

	const result = await getComposition().accounts.loginFromApp({
		email: parsed.data.email,
		password: parsed.data.password,
		remoteIp: clientIpOf(event.getClientAddress),
		appId: app.id,
		deviceName: app.deviceName,
		appVersion: app.version
	});
	return jsonResponse(result, { status: 200, headers: { 'cache-control': 'no-store' } });
});

export const fallback = apiFallback(['POST']);
