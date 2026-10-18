// Layout de administración (W33–W50; BE-FR-10, T300). No es barrera: cada página y cada acción vuelven a comprobar el rol de
// administrador (T301). Aquí se decide qué se muestra: la navegación, el aviso del freno global y el número de alertas activas.
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor } from '$lib/server/features/accounts';
import { activeAlerts } from '$lib/server/features/notifications';
import { brakeStatus } from '$lib/server/features/protections';
import * as m from '$lib/paraglide/messages.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	const isAdmin = accessFor(locals.user, 'admin').kind === 'allow';
	if (!isAdmin) {
		return { isAdmin, links: [], brakeActive: false, alertsHref: '', alertsActiveCount: 0 };
	}
	const composition = getComposition();
	const brake = brakeStatus({ db: composition.db, clock: composition.clock });
	return {
		isAdmin,
		links: [
			{ href: resolve('/admin'), label: m.admin_nav_home() },
			{ href: resolve('/admin/usuarios'), label: m.admin_nav_users() },
			{ href: resolve('/admin/facturacion'), label: m.admin_nav_billing() },
			{ href: resolve('/admin/apps'), label: m.admin_nav_apps() },
			{ href: resolve('/admin/economia'), label: m.admin_nav_economy() },
			{ href: resolve('/admin/anuncios'), label: m.admin_nav_announcements() },
			{ href: resolve('/admin/protecciones'), label: m.admin_nav_protections() },
			{ href: resolve('/admin/estadisticas'), label: m.admin_nav_stats() },
			{ href: resolve('/admin/legal'), label: m.admin_nav_legal() },
			{ href: resolve('/admin/auditoria'), label: m.admin_nav_audit() }
		],
		brakeActive: brake.active,
		alertsHref: resolve('/admin'),
		alertsActiveCount: activeAlerts(composition.db).length
	};
};
