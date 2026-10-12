// E10–E11 · `GET` y `PUT /api/v1/sync` (contracts/api-v1.md E10–E11, BE-FR-41, D-19; T218). Exige versión, mantenimiento y
// documentos legales aceptados. `PUT` exige `If-Match` con la revisión leída: sin coincidencia responde 412.
import { apiFallback, apiRoute } from '$lib/server/api/handler';
import { firstIssuePath, jsonBodyOf } from '$lib/server/api/body';
import { validationErrorResponse } from '$lib/server/api/errors';
import { jsonResponse } from '$lib/server/api/headers';
import { requireAcceptedTerms, guardEndpoint } from '$lib/server/api/sync-gate';
import { requireApp, requireAppSession } from '$lib/server/api/session';
import { getComposition } from '$lib/server/composition.cache';
import {
	getSyncDocument,
	parseIfMatch,
	putSyncDocument,
	PutSyncBody
} from '$lib/server/features/sync';

const NO_STORE = { 'cache-control': 'private, no-store' };

export const GET = apiRoute((event) => {
	const app = requireApp(event);
	const session = requireAppSession(event);
	guardEndpoint('sync', app);
	requireAcceptedTerms(session.userId);

	const document = getSyncDocument(getComposition().sync, {
		userId: session.userId,
		appId: app.id
	});
	return jsonResponse(document, { status: 200, headers: NO_STORE });
});

export const PUT = apiRoute(async (event) => {
	const app = requireApp(event);
	const session = requireAppSession(event);
	guardEndpoint('sync', app);
	requireAcceptedTerms(session.userId);

	const ifMatch = parseIfMatch(event.request.headers.get('If-Match'));
	if (ifMatch === null) return validationErrorResponse('If-Match');

	const parsed = PutSyncBody.safeParse(await jsonBodyOf(event.request));
	if (!parsed.success) return validationErrorResponse(firstIssuePath(parsed.error.issues));

	const result = putSyncDocument(getComposition().sync, {
		userId: session.userId,
		appId: app.id,
		ifMatch,
		data: parsed.data.data
	});
	return jsonResponse(result, { status: 200, headers: NO_STORE });
});

export const fallback = apiFallback(['GET', 'PUT']);
