// E08 · `POST /api/v1/ai/transcribe` (contracts/api-v1.md E08; BE-FR-35, BE-FR-44; T185). Multipart con `operation` y
// `file`. Sin `Origin` (D-01), sin comprobaciones de `protections` aquí: se componen en el servicio. El fichero se acota
// con `max_audio_mb` de la app; si lo excede, `413 PAYLOAD_TOO_LARGE`, y si no es un audio legible, `VALIDATION_ERROR`.
import { apiFallback, apiRoute } from '$lib/server/api/handler';
import { validationErrorResponse } from '$lib/server/api/errors';
import { jsonResponse } from '$lib/server/api/headers';
import { firstIssuePath } from '$lib/server/api/body';
import { requireApp, requireAppSession } from '$lib/server/api/session';
import { getComposition } from '$lib/server/composition.cache';
import { idempotencyKeyOf, runTranscription, transcriptionFormOf } from '$lib/server/features/ai';
import { getEffectiveConfig } from '$lib/server/features/apps';
import { AppError } from '$lib/server/shared/errors';

export const POST = apiRoute(async (event) => {
	const app = requireApp(event);
	const session = requireAppSession(event);

	const key = idempotencyKeyOf(event.request.headers.get('Idempotency-Key'));
	if (!key.ok) return validationErrorResponse('Idempotency-Key');

	const composition = getComposition();
	const maxAudioMb = getEffectiveConfig(composition.apps, { appId: app.id }).settings.max_audio_mb;
	let form: FormData;
	try {
		form = await event.request.formData();
	} catch {
		// Un cuerpo que supera el límite del servidor no se puede leer: si lo declara mayor que el audio máximo, es 413.
		if (Number(event.request.headers.get('content-length') ?? 0) > maxAudioMb * 1024 * 1024) {
			throw new AppError('PAYLOAD_TOO_LARGE', { field: 'file' });
		}
		return validationErrorResponse('file');
	}

	const parsed = transcriptionFormOf(maxAudioMb * 1024 * 1024).safeParse({
		operation: form.get('operation'),
		file: form.get('file')
	});
	if (!parsed.success) {
		if (parsed.error.issues.some((issue) => issue.code === 'too_big')) {
			throw new AppError('PAYLOAD_TOO_LARGE', { field: 'file' });
		}
		return validationErrorResponse(firstIssuePath(parsed.error.issues));
	}

	const file = parsed.data.file;
	const result = await runTranscription(
		composition.ai,
		composition.media,
		{
			userId: session.userId,
			appId: app.id,
			appTitle: app.name,
			sessionId: session.sessionId,
			appVersion: app.version,
			idempotencyKey: key.key,
			signal: event.request.signal
		},
		{
			operation: parsed.data.operation,
			audio: {
				bytes: new Uint8Array(await file.arrayBuffer()),
				name: file.name,
				mimeType: file.type
			}
		}
	);

	// El cliente ya no está: la operación quedó cancelada o no entregada.
	if (result === null) return new Response(null, { status: 204 });
	return jsonResponse(result, { status: 200, headers: { 'cache-control': 'no-store' } });
});

export const fallback = apiFallback(['POST']);
