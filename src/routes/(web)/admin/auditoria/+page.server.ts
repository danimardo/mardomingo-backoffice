// W46 · `/admin/auditoria` (contracts/web-routes.md W46; BE-FR-55; T303). Lista de la auditoría con filtros GET (entidad, acción,
// día) y paginación. Solo lectura: no tiene acciones. Requiere rol de administrador en cada carga.
import { error, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor } from '$lib/server/features/accounts';
import { auditPage } from '$lib/server/features/audit';
import { toEpochMs } from '$lib/shared/time';
import type { PageServerLoad } from './$types';

const DAY_MS = 24 * 60 * 60 * 1000;

function dayStart(value: string | null): number | null {
	if (value === null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
	const ms = Date.parse(`${value}T00:00:00Z`);
	return Number.isNaN(ms) ? null : ms;
}

export const load: PageServerLoad = ({ locals, url, setHeaders }) => {
	const access = accessFor(locals.user, 'admin');
	if (access.kind === 'anonymous' || access.kind === 'blocked' || access.kind === 'unverified') {
		const login = resolve('/login');
		redirect(303, login);
	}
	if (access.kind !== 'allow') error(403);
	setHeaders({ 'cache-control': 'private, no-store' });

	const from = dayStart(url.searchParams.get('desde'));
	const to = dayStart(url.searchParams.get('hasta'));
	const page = Math.max(1, Number.parseInt(url.searchParams.get('pagina') ?? '1', 10) || 1);
	const entity = url.searchParams.get('entidad') || null;
	const action = url.searchParams.get('accion') || null;
	const result = auditPage(getComposition().db, {
		entity,
		action,
		fromMs: from === null ? null : toEpochMs(from),
		toMs: to === null ? null : toEpochMs(to + DAY_MS - 1),
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
