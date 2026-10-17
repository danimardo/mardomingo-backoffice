// E13 · `GET /api/v1/health` (contracts/api-v1.md 1.8, D-19): sin `X-App-Id`, responde con cualquier `Host`.
import { apiFallback, apiRoute } from '$lib/server/api/handler';
import { jsonResponse } from '$lib/server/api/headers';
import { getComposition } from '$lib/server/composition.cache';

export const GET = apiRoute(() => {
	try {
		getComposition().sqlite.prepare('SELECT 1').get();
		return jsonResponse({ status: 'ok' }, { status: 200 });
	} catch {
		return jsonResponse({ status: 'unavailable' }, { status: 503 });
	}
});

export const fallback = apiFallback(['GET']);
