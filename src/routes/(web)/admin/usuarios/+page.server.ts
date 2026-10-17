// W34 · `/admin/usuarios` (contracts/web-routes.md W34; BE-FR-50; T306). Búsqueda por email o id con paginación. Solo lectura:
// el formulario es GET (`q`, `pagina`). Requiere rol de administrador en cada carga.
import { error, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor, searchUsers } from '$lib/server/features/accounts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url, setHeaders }) => {
	const access = accessFor(locals.user, 'admin');
	if (access.kind === 'anonymous' || access.kind === 'blocked' || access.kind === 'unverified') {
		const login = resolve('/login');
		redirect(303, login);
	}
	if (access.kind !== 'allow') error(403);
	setHeaders({ 'cache-control': 'private, no-store' });

	const query = url.searchParams.get('q') ?? '';
	const page = Math.max(1, Number.parseInt(url.searchParams.get('pagina') ?? '1', 10) || 1);
	const result = searchUsers(getComposition().adminUsers, query, page);
	return { q: query, rows: result.rows, pagination: result.pagination };
};
