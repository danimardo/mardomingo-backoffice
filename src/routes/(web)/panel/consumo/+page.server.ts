// W24 · `/panel/consumo` (contracts/web-routes.md W24; BE-FR-49.4, UX-09). Lista de operaciones de IA de la cuenta, con estado y
// créditos cobrados. Mismos filtros que movimientos: día y app, en la URL (funciona sin JavaScript).
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { consumptionPage } from '$lib/server/features/ai';
import { accessFor, reportDenial } from '$lib/server/features/accounts';
import { appNamesOf } from '$lib/server/features/apps';
import { parsePanelFilters, queryOfFilters } from '$lib/schemas/common/filters';
import { civilDateOf, madridMidnight, addDays } from '$lib/shared/dates';
import { toEpochMs, type EpochMs } from '$lib/shared/time';
import type { PageServerLoad } from './$types';

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

	const echo = {
		desde: url.searchParams.get('desde') ?? '',
		hasta: url.searchParams.get('hasta') ?? ''
	};
	const parsed = parsePanelFilters(Object.fromEntries(url.searchParams));
	if (!parsed.ok) {
		return {
			echo,
			filters: null,
			errors: parsed.errors,
			rows: [],
			pagination: null,
			exportHref: null,
			applied: false
		};
	}
	const composition = getComposition();
	const filters = parsed.value;
	const fromMs = filters.desde === null ? null : madridMidnight(filters.desde);
	const toMs: EpochMs | null =
		filters.hasta === null ? null : toEpochMs(madridMidnight(addDays(filters.hasta, 1)) - 1);
	const page = consumptionPage(composition.db, {
		userId: access.user.id,
		fromMs,
		toMs,
		appId: filters.app,
		page: filters.pagina
	});
	const names = appNamesOf(
		composition.apps,
		page.rows.map((row) => row.appId)
	);

	return {
		echo,
		filters,
		errors: NO_ERRORS,
		rows: page.rows.map((row) => ({
			date: civilDateOf(row.createdAt),
			appName: names.get(row.appId) ?? '',
			operation: row.operation,
			status: row.status,
			credits: row.chargedMicro / 1_000_000
		})),
		pagination: {
			...page.pagination,
			previousHref: `${resolve('/panel/consumo')}${queryOfFilters(filters, page.pagination.page - 1)}`,
			nextHref: `${resolve('/panel/consumo')}${queryOfFilters(filters, page.pagination.page + 1)}`
		},
		exportHref: null,
		applied: filters.desde !== null || filters.hasta !== null || filters.app !== null
	};
};
