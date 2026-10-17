// W47 · `/admin/auditoria/[entryId]` (contracts/web-routes.md W47; BE-FR-55, UX-13; T303). Una entrada con su motivo y sus
// instantáneas anterior y nueva. Solo lectura. Una entrada inexistente responde 404.
import { error, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor } from '$lib/server/features/accounts';
import { auditEntry } from '$lib/server/features/audit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params, setHeaders }) => {
	const access = accessFor(locals.user, 'admin');
	if (access.kind === 'anonymous' || access.kind === 'blocked' || access.kind === 'unverified') {
		const login = resolve('/login');
		redirect(303, login);
	}
	if (access.kind !== 'allow') error(403);
	setHeaders({ 'cache-control': 'private, no-store' });

	const entry = auditEntry(getComposition().db, params.entryId);
	if (entry === null) error(404);
	return {
		entry: {
			id: entry.id,
			adminId: entry.adminId,
			action: entry.action,
			entity: entry.entity,
			entityId: entry.entityId,
			reason: entry.reason,
			before: entry.before,
			after: entry.after,
			createdAt: new Date(entry.createdAt).toISOString()
		}
	};
};
