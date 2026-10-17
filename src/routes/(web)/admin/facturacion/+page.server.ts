// W50 · `/admin/facturacion` (contracts/web-routes.md W50; BE-FR-76, FR-048; T316). Vista del periodo con el filtro GET (`desde`,
// `hasta`) y los enlaces de descarga del informe. Las compras simuladas no cuentan como ingresos. Solo administradores.
import { error, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { accessFor } from '$lib/server/features/accounts';
import { accountingReport } from '$lib/server/web/accounting-report';
import { getComposition } from '$lib/server/composition.cache';
import type { PageServerLoad } from './$types';

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
	const fromMs = Date.parse(`${desde}T00:00:00Z`);
	const toMs = Date.parse(`${hasta}T23:59:59Z`);
	if (desde === '' || hasta === '' || Number.isNaN(fromMs) || Number.isNaN(toMs) || fromMs > toMs) {
		return { desde, hasta, period: false as const, sales: 0, unconverted: 0 };
	}
	const report = accountingReport(getComposition(), { fromMs, toMs });
	return {
		desde,
		hasta,
		period: true as const,
		sales: report.purchases,
		unconverted: report.unconverted
	};
};
