// W01 · `/` (contracts/web-routes.md W01; BE-FR-59, FR-100). Landing de la marca: solo lee las apps activas y el soporte. Sin
// acciones: el tema y los efectos se cambian en W16.
import { getComposition } from '$lib/server/composition.cache';
import { landingListOf, landingRows, supportEmail } from '$lib/server/features/apps';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const { apps, db } = getComposition();
	return {
		apps: landingListOf(landingRows(db)),
		supportEmail: supportEmail(apps)
	};
};
