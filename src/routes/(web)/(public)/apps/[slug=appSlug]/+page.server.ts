// W02 · `/apps/[slug=appSlug]` (contracts/web-routes.md W02; BE-FR-59, FR-100, FR-101, UX-16). Landing pública de una app. Una
// app desactivada se muestra con su aviso (sin descarga ni alta); una inexistente responde 404.
import { error } from '@sveltejs/kit';
import { getComposition } from '$lib/server/composition.cache';
import { appPageOf, landingRowBySlug, supportEmail } from '$lib/server/features/apps';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const { apps, db } = getComposition();
	const row = landingRowBySlug(db, params.slug);
	if (row === undefined) error(404);
	return appPageOf(row, supportEmail(apps));
};
