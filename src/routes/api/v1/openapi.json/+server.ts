// E14 · `GET /api/v1/openapi.json` (contracts/api-v1.md E14): documento OpenAPI 3.1 generado desde los esquemas. No es público:
// exige la app (`X-App-Id`) y una sesión Bearer de esa app, como el resto de la API salvo `/health`. No se bloquea por versión
// mínima ni por mantenimiento: es documentación y debe poder leerse siempre que haya sesión.
import { apiFallback, apiRoute } from '$lib/server/api/handler';
import { openApiJson } from '$lib/server/api/openapi.cache';
import { requireAppSession } from '$lib/server/api/session';
import { getComposition } from '$lib/server/composition.cache';

export const GET = apiRoute((event) => {
	requireAppSession(event);
	const { config } = getComposition();
	return new Response(openApiJson(config.PUBLIC_API_URL), {
		status: 200,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'private, no-store'
		}
	});
});

export const fallback = apiFallback(['GET']);
