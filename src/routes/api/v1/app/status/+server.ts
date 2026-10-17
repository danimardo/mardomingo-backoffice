// E01 · `GET /api/v1/app/status` (contracts/api-v1.md E01; BE-FR-48 CA2, BE-FR-77 CA4, BE-FR-84, BE-FR-85; T193). Público
// con `X-App-Id`: sin sesión, sin versión mínima y sin bloqueo por mantenimiento (informa de él). Una query desconocida es
// `VALIDATION_ERROR`. Nunca responde `MAINTENANCE` ni `UPGRADE_REQUIRED`.
import { apiFallback, apiRoute } from '$lib/server/api/handler';
import { apiErrorResponse, validationErrorResponse } from '$lib/server/api/errors';
import { jsonResponse } from '$lib/server/api/headers';
import { requireApp } from '$lib/server/api/session';
import { getComposition } from '$lib/server/composition.cache';
import { appStatusOf } from '$lib/server/features/apps';

export const GET = apiRoute((event) => {
	const app = requireApp(event);
	if ([...event.url.searchParams.keys()].length > 0) return validationErrorResponse('query');

	const composition = getComposition();
	const status = appStatusOf(composition.apps, {
		appId: app.id,
		version: app.version,
		now: composition.clock.now(),
		webBaseUrl: composition.config.PUBLIC_WEB_URL
	});
	if (status === undefined) return apiErrorResponse('UNKNOWN_APP');
	return jsonResponse(status, { status: 200, headers: { 'cache-control': 'no-store' } });
});

export const fallback = apiFallback(['GET']);
