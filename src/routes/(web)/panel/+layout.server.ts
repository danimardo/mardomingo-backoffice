// Layout del panel (T259; BE-FR-86, BE-FR-84). No es barrera: sin cuenta verificada no escribe nada y no muestra recuentos. Con
// cuenta verificada marca la última actividad (`accounts`) y da los recuentos de documentos pendientes y de anuncios activos.
import { getComposition } from '$lib/server/composition.cache';
import { accessFor, appsUsedBy, touchActivity } from '$lib/server/features/accounts';
import { announcementsForPanel } from '$lib/server/features/apps';
import { pendingAcceptancesOf } from '$lib/server/features/legal';
import { syncedAppIds } from '$lib/server/features/sync';
import { toEpochMs } from '$lib/shared/time';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	const access = accessFor(locals.user, 'verified');
	if (access.kind !== 'allow') return { pendingAcceptancesCount: 0, activeAnnouncementsCount: 0 };

	const composition = getComposition();
	const now = toEpochMs(composition.clock.now());
	touchActivity(composition.db, access.user.id, now);
	const appIds = [
		...new Set([
			...appsUsedBy(composition.db, access.user.id),
			...syncedAppIds(composition.db, access.user.id)
		])
	];
	return {
		pendingAcceptancesCount: pendingAcceptancesOf(composition.db, access.user.id, now).length,
		activeAnnouncementsCount: announcementsForPanel(composition.apps, appIds, now).length
	};
};
