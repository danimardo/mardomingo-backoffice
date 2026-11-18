// W51 · `GET /admin/facturacion/exportar` (contracts/web-routes.md W51; BE-FR-76, FR-048; T316). Descarga un CSV del informe contable
// del periodo: `archivo` elige ventas (por defecto), resumen mensual o coste de IA. Solo administradores; sin caché.
import { error, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor } from '$lib/server/features/accounts';
import { accountingReport } from '$lib/server/web/accounting-report';
import { madridPeriodBounds } from '$lib/shared/dates';
import type { RequestHandler } from './$types';

const FILES = Object.freeze({
	ventas: 'salesCsv',
	mensual: 'monthlyCsv',
	ia: 'aiCostsCsv'
} as const);

/** Periodo `AAAA-MM-DD`..`AAAA-MM-DD` como intervalo de días de Madrid. */
function bounds(desde: string, hasta: string): { fromMs: number; toMs: number } | null {
	return madridPeriodBounds(desde, hasta);
}

export const GET: RequestHandler = ({ locals, url }) => {
	const access = accessFor(locals.user, 'admin');
	if (access.kind === 'anonymous' || access.kind === 'blocked' || access.kind === 'unverified') {
		const login = resolve('/login');
		redirect(303, login);
	}
	if (access.kind !== 'allow') error(403);

	const period = bounds(url.searchParams.get('desde') ?? '', url.searchParams.get('hasta') ?? '');
	if (period === null) error(400);
	const key = url.searchParams.get('archivo') ?? 'ventas';
	if (key !== 'ventas' && key !== 'mensual' && key !== 'ia') error(400);

	const report = accountingReport(getComposition(), period);
	const csv = report.export[FILES[key]];
	const name = `contable-${key}-${url.searchParams.get('desde') ?? ''}-${url.searchParams.get('hasta') ?? ''}.csv`;
	return new Response(csv, {
		status: 200,
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="${name}"`,
			'cache-control': 'private, no-store'
		}
	});
};
