// W23 · `GET /panel/movimientos/exportar` (contracts/web-routes.md W23; BE-FR-49.6). Mismos filtros que W22; devuelve todas las
// filas que coinciden (no solo la página), en CSV de hoja de cálculo. Solo las de la cuenta que pide.
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor } from '$lib/server/features/accounts';
import { appNamesOf } from '$lib/server/features/apps';
import { movementRowsOf, type MovementFact } from '$lib/server/features/credits/csv-rows';
import { parsePanelFilters } from '$lib/schemas/common/filters';
import { toCsv } from '$lib/server/shared/csv';
import { addDays, madridMidnight } from '$lib/shared/dates';
import { toEpochMs, type CivilDate } from '$lib/shared/time';
import type { RequestHandler } from './$types';

const HEADER = ['fecha', 'tipo', 'creditos', 'app'] as const;

export const GET: RequestHandler = ({ locals, url }) => {
	const access = accessFor(locals.user, 'verified');
	if (access.kind !== 'allow') {
		const login = resolve('/login');
		redirect(303, login);
	}
	const parsed = parsePanelFilters(Object.fromEntries(url.searchParams));
	if (!parsed.ok) return new Response('filtros no válidos', { status: 400 });

	const composition = getComposition();
	const filters = parsed.value;
	const fromMs = filters.desde === null ? null : madridMidnight(filters.desde);
	const toMs =
		filters.hasta === null ? null : toEpochMs(madridMidnight(addDays(filters.hasta, 1)) - 1);

	const found: MovementFact[] = [];
	const appIds = new Set<string>();
	for (let page = 1; ; page += 1) {
		const result = composition.credits.movements({
			userId: access.user.id,
			fromMs,
			toMs,
			appId: filters.app,
			page
		});
		for (const row of result.rows) {
			if (row.appId !== null) appIds.add(row.appId);
			found.push({
				createdAt: row.createdAt,
				type: row.type,
				amountMicro: row.amountMicro,
				appName: null,
				appId: row.appId
			});
		}
		if (!result.pagination.hasNext) break;
	}
	const names = appNamesOf(composition.apps, [...appIds]);
	const facts = found.map((fact) => ({
		...fact,
		appName: typeof fact.appId === 'string' ? (names.get(fact.appId) ?? null) : null
	}));

	return new Response(toCsv(movementRowsOf(facts), { header: HEADER, bom: true }), {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="movimientos-${bound(filters.desde, 'inicio')}_${bound(filters.hasta, 'fin')}.csv"`,
			'cache-control': 'private, no-store'
		}
	});
};

function bound(day: CivilDate | null, fallback: string): string {
	return day === null ? fallback : String(day);
}
