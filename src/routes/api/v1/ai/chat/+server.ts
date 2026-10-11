// E07 · `POST /api/v1/ai/chat` (contracts/api-v1.md E07, 1.6, 1.7; BE-FR-30–34, BE-FR-81; T172). Valida la cabecera de
// idempotencia y el cuerpo con el contrato, y pasa la señal de la petición al servicio: si el cliente se va, la llamada
// al proveedor se aborta (D-05). No devuelve nunca el modelo ni el proveedor.
import { apiFallback, apiRoute } from '$lib/server/api/handler';
import { validationErrorResponse } from '$lib/server/api/errors';
import { jsonResponse } from '$lib/server/api/headers';
import { firstIssuePath, jsonBodyOf } from '$lib/server/api/body';
import { requireApp, requireAppSession } from '$lib/server/api/session';
import { getComposition } from '$lib/server/composition.cache';
import { ChatRequestBody, idempotencyKeyOf, runChat } from '$lib/server/features/ai';

export const POST = apiRoute(async (event) => {
	const app = requireApp(event);
	const session = requireAppSession(event);

	const key = idempotencyKeyOf(event.request.headers.get('Idempotency-Key'));
	if (!key.ok) return validationErrorResponse('Idempotency-Key');

	const parsed = ChatRequestBody.safeParse(await jsonBodyOf(event.request));
	if (!parsed.success) return validationErrorResponse(firstIssuePath(parsed.error.issues));

	const result = await runChat(
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

	// El cliente ya no está: no hay nada que entregar, y la operación quedó cancelada o no entregada.
	if (result === null) return new Response(null, { status: 204 });
	return jsonResponse(result, { status: 200, headers: { 'cache-control': 'no-store' } });
});

export const fallback = apiFallback(['POST']);
