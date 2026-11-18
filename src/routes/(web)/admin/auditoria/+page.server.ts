// W46 · `/admin/auditoria` (contracts/web-routes.md W46; BE-FR-55; T303). Lista de la auditoría con filtros GET (entidad, acción,
// día) y paginación. Solo lectura: no tiene acciones. Requiere rol de administrador en cada carga.
import { error, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor } from '$lib/server/features/accounts';
import { auditPage } from '$lib/server/features/audit';
import { madridPeriodBounds } from '$lib/shared/dates';
import { pageNumber } from '$lib/shared/paging';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url, setHeaders }) => {
	const access = accessFor(locals.user, 'admin');
	if (access.kind === 'anonymous' || access.kind === 'blocked' || access.kind === 'unverified') {
		const login = resolve('/login');
		redirect(303, login);
	}
	if (access.kind !== 'allow') error(403);
	setHeaders({ 'cache-control': 'private, no-store' });

	const desde = url.searchParams.get('desde');
	const hasta = url.searchParams.get('hasta');
	// Cada filtro de día es un día civil de Madrid: `desde` desde sus 00:00 y `hasta` hasta su último milisegundo.
	const from = desde === null ? null : madridPeriodBounds(desde, desde);
	const to = hasta === null ? null : madridPeriodBounds(hasta, hasta);
	const page = pageNumber(url.searchParams.get('pagina'));
	const entity = url.searchParams.get('entidad') || null;
	const action = url.searchParams.get('accion') || null;
	const result = auditPage(getComposition().db, {
		entity,
		action,
		fromMs: from === null ? null : from.fromMs,
		toMs: to === null ? null : to.toMs,
		page
	});
	return {
		filters: {
			entidad: entity ?? '',
			accion: action ?? '',
			desde: url.searchParams.get('desde') ?? '',
			hasta: url.searchParams.get('hasta') ?? ''
		},
		total: result.total,
		rows: result.rows.map((row) => ({
			id: row.id,
			action: row.action,
			entity: row.entity,
			entityId: row.entityId,
			reason: row.reason,
			createdAt: new Date(row.createdAt).toISOString()
		})),
		pagination: result.pagination
	};
};
