// E12 · `GET /api/v1/defaults` (contracts/api-v1.md E12, BE-FR-42 CA2; T218). Solo exige versión (D-19): no se bloquea por
// mantenimiento ni por documentos legales pendientes, porque Secretario lo usa para «Restaurar valores predeterminados».
import { apiFallback, apiRoute } from '$lib/server/api/handler';
import { jsonResponse } from '$lib/server/api/headers';
import { guardEndpoint } from '$lib/server/api/sync-gate';
import { requireApp } from '$lib/server/api/session';
import { getComposition } from '$lib/server/composition.cache';
import { getDefaults } from '$lib/server/features/sync';

export const GET = apiRoute((event) => {
	const app = requireApp(event);
	guardEndpoint('defaults', app);

	const data = getDefaults(getComposition().sync, app.id);
	return jsonResponse({ data }, { status: 200, headers: { 'cache-control': 'private, no-store' } });
});

export const fallback = apiFallback(['GET']);
