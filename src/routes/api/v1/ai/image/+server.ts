// E09 · `POST /api/v1/ai/image` (contracts/api-v1.md E09; BE-FR-35, BE-FR-36; T185). JSON con `operation` y `prompt`
// (libre) o `variables` (plantilla). La imagen vuelve como _data URL_ y no se guarda.
import { apiFallback, apiRoute } from '$lib/server/api/handler';
import { validationErrorResponse } from '$lib/server/api/errors';
import { jsonResponse } from '$lib/server/api/headers';
import { firstIssuePath, jsonBodyOf } from '$lib/server/api/body';
import { requireApp, requireAppSession } from '$lib/server/api/session';
import { getComposition } from '$lib/server/composition.cache';
import { ImageRequestBody, idempotencyKeyOf, runImage } from '$lib/server/features/ai';

export const POST = apiRoute(async (event) => {
	const app = requireApp(event);
	const session = requireAppSession(event);

	const key = idempotencyKeyOf(event.request.headers.get('Idempotency-Key'));
	if (!key.ok) return validationErrorResponse('Idempotency-Key');

	const parsed = ImageRequestBody.safeParse(await jsonBodyOf(event.request));
	if (!parsed.success) return validationErrorResponse(firstIssuePath(parsed.error.issues));

	const result = await runImage(
		getComposition().ai,
		{
			userId: session.userId,
			appId: app.id,
			appTitle: app.name,
			sessionId: session.sessionId,
			appVersion: app.version,
			idempotencyKey: key.key,
			signal: event.request.signal
		},
		parsed.data
	);

	if (result === null) return new Response(null, { status: 204 });
	return jsonResponse(result, { status: 200, headers: { 'cache-control': 'no-store' } });
});

export const fallback = apiFallback(['POST']);
