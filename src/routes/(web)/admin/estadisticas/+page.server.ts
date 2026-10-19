// W45 · `/admin/estadisticas` (contracts/web-routes.md W45; BE-FR-54; T319). Estadísticas de un periodo con filtro GET (`desde`, `hasta`).
// Solo lectura, compuesta desde las API públicas de `payments`, `ai`, `credits`, `accounts` y `pricing`. Lo que todavía no tiene datos
// (descargas, hasta L14) se muestra como «sin datos», nunca como cero. Requiere rol de administrador.
import { error, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import {
	accessFor,
	activeUsersBetween,
	firstLoginsBetween,
	signupsBetween
} from '$lib/server/features/accounts';
import { firstOperationsBetween, operationStatsBetween } from '$lib/server/features/ai';
import { forfeitsBetween } from '$lib/server/features/credits';
import { usdEurPpmOf } from '$lib/server/features/pricing';
import { releaseDownloadsBetween, statsForPeriod } from '$lib/server/features/stats';
import { toCivilDate } from '$lib/shared/time';
import type { PageServerLoad } from './$types';

function bounds(desde: string, hasta: string): { fromMs: number; toMs: number } | null {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) return null;
	const fromMs = Date.parse(`${desde}T00:00:00Z`);
	const toMs = Date.parse(`${hasta}T23:59:59Z`);
	return Number.isNaN(fromMs) || Number.isNaN(toMs) || fromMs > toMs ? null : { fromMs, toMs };
}

export const load: PageServerLoad = ({ locals, url, setHeaders }) => {
	const access = accessFor(locals.user, 'admin');
	if (access.kind === 'anonymous' || access.kind === 'blocked' || access.kind === 'unverified') {
		const login = resolve('/login');
		redirect(303, login);
	}
	if (access.kind !== 'allow') error(403);
	setHeaders({ 'cache-control': 'private, no-store' });

	const desde = url.searchParams.get('desde') ?? '';
	const hasta = url.searchParams.get('hasta') ?? '';
	const period = bounds(desde, hasta);
	if (period === null) return { desde, hasta, stats: null };

	const composition = getComposition();
	const stats = statsForPeriod(
		{
			paymentFacts: (p) => composition.payments.paymentFactsBetween(p),
			operationFacts: (p) => operationStatsBetween(composition.db, p),
			forfeits: (p) => forfeitsBetween(composition.db, p),
			signups: (p) => signupsBetween(composition.db, p),
			firstLogins: (p) => firstLoginsBetween(composition.db, p),
			activeUsers: (p) => activeUsersBetween(composition.db, p),
			usdEurPpmOf: (id) => usdEurPpmOf(composition.pricing, id),
			firstOperations: (p) => firstOperationsBetween(composition.db, p),
			downloads: () =>
				releaseDownloadsBetween(composition.db, {
					fromDay: toCivilDate(desde),
					toDay: toCivilDate(hasta)
				})
		},
		period
	);
	return {
		desde,
		hasta,
		stats: {
			revenueEurCents: stats.totals.revenueEurCents,
			costEurCents: stats.totals.costEurCents,
			marginEurCents: stats.totals.marginEurCents,
			cancellationCostEurCents: stats.totals.cancellationCostEurCents,
			realPurchases: stats.totals.realPurchases,
			simulatedPurchases: stats.totals.simulatedPurchases,
			unconvertedOperations: stats.totals.unconvertedOperations,
			absorbedDebtMicro: stats.totals.absorbedDebtMicro,
			absorbedReplayMicro: stats.totals.absorbedReplayMicro,
			forfeitedMicro: stats.totals.forfeitedMicro,
			activeUsers: stats.totals.activeUsers,
			signupsByApp: [...stats.totals.signupsByApp.entries()],
			firstLoginsByApp: [...stats.totals.firstLoginsByApp.entries()],
			funnel: stats.totals.funnel,
			downloads: stats.totals.downloads
		}
	};
};
