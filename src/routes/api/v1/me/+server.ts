// E05 · `GET /api/v1/me` (contracts/api-v1.md E05; BE-FR-49.7, BE-FR-63, BE-FR-70 CA1, BE-FR-71 CA2; T136). Con token Bearer de la
// app; exige versión mínima pero no se bloquea por mantenimiento ni por documentos pendientes. Cuenta como actividad (BE-FR-86).
import { apiFallback, apiRoute } from '$lib/server/api/handler';
import { jsonResponse } from '$lib/server/api/headers';
import { requireApp, requireAppSession } from '$lib/server/api/session';
import { guardEndpoint } from '$lib/server/api/sync-gate';
import { getComposition } from '$lib/server/composition.cache';
import { touchActivity } from '$lib/server/features/accounts';
import { balanceDto } from '$lib/server/features/credits';
import { pendingAcceptancesOf } from '$lib/server/features/legal';

export const GET = apiRoute((event) => {
	const app = requireApp(event);
	guardEndpoint('me', app);
	const session = requireAppSession(event);
	const user = event.locals.user;
	if (user === null) return new Response(null, { status: 401 });

	const composition = getComposition();
	const now = composition.clock.now();
	touchActivity(composition.db, session.userId, now);
	return jsonResponse(
		{
			email: user.email,
			roles: user.role.split(','),
			balance: balanceDto(composition.credits.getBalance(session.userId)),
			lowBalanceThresholdMicro: composition.credits.lowBalance(session.userId).thresholdMicro,
			hasRealPurchase: composition.credits
				.realPurchaseUserIds([session.userId])
				.has(session.userId),
			pendingAcceptances: pendingAcceptancesOf(composition.db, session.userId, now).map((item) => ({
				document: item.document,
				version: item.version
			}))
		},
		{ status: 200, headers: { 'cache-control': 'private, no-store' } }
	);
});

export const fallback = apiFallback(['GET']);
