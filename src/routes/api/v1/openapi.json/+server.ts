// E14 · `GET /api/v1/openapi.json` (contracts/api-v1.md E14): documento OpenAPI 3.1 generado desde los esquemas.
import { apiFallback, apiRoute } from '$lib/server/api/handler';
import { API_NO_STORE_HEADERS } from '$lib/server/api/headers';
import { openApiJson } from '$lib/server/api/openapi.cache';
import { getComposition } from '$lib/server/composition.cache';

export const GET = apiRoute(() => {
	const { config } = getComposition();
	return new Response(openApiJson(config.PUBLIC_API_URL), {
		status: 200,
		headers: { 'content-type': 'application/json; charset=utf-8', ...API_NO_STORE_HEADERS }
	});
});

export const fallback = apiFallback(['GET']);
