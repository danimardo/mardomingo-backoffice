// W22 · `/panel/movimientos` (contracts/web-routes.md W22; BE-FR-49.3, UX-09). Formulario GET: desde, hasta, app y página viven
// en la URL, así que cada resultado se puede compartir y funciona sin JavaScript. Los filtros se validan con `parsePanelFilters`.
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor, reportDenial } from '$lib/server/features/accounts';
import { appNamesOf } from '$lib/server/features/apps';
import { usedAppOptionsOf } from '$lib/server/web/used-apps';
import { civilDateOf, madridMidnight, addDays } from '$lib/shared/dates';
import { parsePanelFilters, queryOfFilters, type PanelFilters } from '$lib/schemas/common/filters';
import { toEpochMs, type EpochMs } from '$lib/shared/time';
import type { PageServerLoad } from './$types';

/** Rango de milisegundos de un filtro de días: desde el inicio de «desde» hasta el final de «hasta» (día de Madrid). */
function rangeOf(filters: PanelFilters): {
	readonly fromMs: EpochMs | null;
	readonly toMs: EpochMs | null;
} {
	const fromMs = filters.desde === null ? null : madridMidnight(filters.desde);
	const toMs =
		filters.hasta === null ? null : toEpochMs(madridMidnight(addDays(filters.hasta, 1)) - 1);
	return { fromMs, toMs };
}

const NO_ERRORS: Readonly<Record<string, string>> = Object.freeze({});

export const load: PageServerLoad = ({ locals, setHeaders, url }) => {
	const access = accessFor(locals.user, 'verified');
	reportDenial(locals.log, access);
	if (access.kind === 'anonymous' || access.kind === 'blocked') {
		const login = `${resolve('/login')}?redirectTo=${encodeURIComponent(url.pathname)}`;
		redirect(303, login);
	}
	if (access.kind === 'unverified') {
		const resend = resolve('/verificar/reenviar');
		redirect(303, resend);
	}
	setHeaders({ 'cache-control': 'private, no-store' });
	if (access.kind !== 'allow') {
		const login = resolve('/login');
		redirect(303, login);
	}

	const echo = Object.fromEntries(url.searchParams);
	const parsed = parsePanelFilters(echo);
	if (!parsed.ok) {
		return {
			echo,
			filters: null,
			errors: parsed.errors,
			rows: [],
			pagination: null,
			exportHref: null,
			applied: false,
			appOptions: []
		};
	}
	const composition = getComposition();
	const { fromMs, toMs } = rangeOf(parsed.value);
	const page = composition.credits.movements({
		userId: access.user.id,
		fromMs,
		toMs,
		appId: parsed.value.app,
		page: parsed.value.pagina,
		order: parsed.value.orden
	});
	const appNames = appNamesOf(
		composition.apps,
		page.rows.flatMap((row) => (row.appId === null ? [] : [row.appId]))
	);

	return {
		echo,
		appOptions: usedAppOptionsOf(composition, access.user.id),
		filters: parsed.value,
		errors: NO_ERRORS,
		rows: page.rows.map((row) => ({
			date: civilDateOf(row.createdAt),
			type: row.type,
			credits: row.amountMicro / 1_000_000,
			appName: row.appId === null ? '' : (appNames.get(row.appId) ?? '')
		})),
		pagination: {
			...page.pagination,
			previousHref: `${resolve('/panel/movimientos')}${queryOfFilters(parsed.value, page.pagination.page - 1)}`,
			nextHref: `${resolve('/panel/movimientos')}${queryOfFilters(parsed.value, page.pagination.page + 1)}`
		},
		exportHref: `${resolve('/panel/movimientos/exportar')}${queryOfFilters(parsed.value, null)}`,
		applied: parsed.value.desde !== null || parsed.value.hasta !== null || parsed.value.app !== null
	};
};
