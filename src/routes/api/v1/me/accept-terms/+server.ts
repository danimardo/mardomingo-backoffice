// E06 · `POST /api/v1/me/accept-terms` (contracts/api-v1.md E06; BE-FR-70/CA2; T278). Con token Bearer de la app y sin
// bloqueo por mantenimiento ni por documentos pendientes: es precisamente la vía para aceptarlos. Una versión que ya no es la
// vigente responde `VALIDATION_ERROR` en `documents`. Responde `204` y es idempotente.
import { apiFallback, apiRoute } from '$lib/server/api/handler';
import { firstIssuePath, jsonBodyOf } from '$lib/server/api/body';
import { validationErrorResponse } from '$lib/server/api/errors';
import { guardEndpoint } from '$lib/server/api/sync-gate';
import { requireApp, requireAppSession } from '$lib/server/api/session';
import { getComposition } from '$lib/server/composition.cache';
import { AcceptTermsBody, acceptDocuments } from '$lib/server/features/legal';
import { AppError } from '$lib/server/shared/errors';
import { toEpochMs } from '$lib/shared/time';
import { clientIpOf } from '$lib/server/web/actions';

export const POST = apiRoute(async (event) => {
	const app = requireApp(event);
	guardEndpoint('me.accept_terms', app);
	const session = requireAppSession(event);
	const parsed = AcceptTermsBody.safeParse(await jsonBodyOf(event.request));
	if (!parsed.success) return validationErrorResponse(firstIssuePath(parsed.error.issues));

	const composition = getComposition();
	try {
		acceptDocuments(composition.legal, {
			userId: session.userId,
			ip: clientIpOf(event.getClientAddress),
			now: toEpochMs(composition.clock.now()),
			accepted: parsed.data.documents
		});
	} catch (error) {
		if (error instanceof AppError && error.code === 'LEGAL_VERSION_CHANGED') {
			return validationErrorResponse('documents');
		}
		throw error;
	}
	return new Response(null, { status: 204 });
});

export const fallback = apiFallback(['POST']);
