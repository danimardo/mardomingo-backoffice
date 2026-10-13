// W32 · `/panel/apps` (contracts/web-routes.md W32; BE-FR-49.11). Apps activas con su descripción, enlace de descarga y de acceso
// cuando existen, y la marca de «usada» según la actividad de la cuenta. Sin enlace de descarga configurado, la página dice que
// la descarga no está disponible. Requiere cuenta verificada.
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor, appsUsedBy, reportDenial } from '$lib/server/features/accounts';
import { activeAppsForPanel } from '$lib/server/features/apps';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, setHeaders, url }) => {
	const access = accessFor(locals.user, 'verified');
	reportDenial(locals.log, access);
	if (access.kind === 'anonymous' || access.kind === 'blocked') {
		const login = `${resolve('/login')}?redirectTo=${encodeURIComponent(url.pathname)}`;
		redirect(303, login);
	}
	if (access.kind === 'unverified') {
		const resend = resolve('/verificar/reenviar');
		redirect(303, resend);
	}
	setHeaders({ 'cache-control': 'private, no-store' });
	if (access.kind !== 'allow') {
		const login = resolve('/login');
		redirect(303, login);
	}

	const composition = getComposition();
	const used = appsUsedBy(composition.db, access.user.id);
	return {
		apps: activeAppsForPanel(composition.apps).map((app) => ({
			id: app.id,
			name: app.name,
			description: app.description,
			downloadUrl: app.downloadUrl,
			accessUrl: app.accessUrl,
			used: used.has(app.id)
		}))
	};
};
