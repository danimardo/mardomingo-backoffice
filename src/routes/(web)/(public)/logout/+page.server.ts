// W15 · `/logout` (contracts/web-routes.md W15; BE-FR-06). Requiere sesión: sin ella, al inicio de sesión. La acción
// revoca la sesión de esta petición y borra la cookie.
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor, reportDenial } from '$lib/server/features/accounts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const access = accessFor(locals.user, 'user');
	reportDenial(locals.log, access);
	if (access.kind !== 'allow') {
		const login = `${resolve('/login')}?redirectTo=${encodeURIComponent(resolve('/logout'))}`;
		redirect(303, login);
	}
	return { email: locals.user?.email ?? '' };
};

export const actions: Actions = {
	salir: async ({ request }) => {
		await getComposition().accounts.logout(request.headers);
		const next = `${resolve('/login')}?aviso=logged_out`;
		redirect(303, next);
	}
};
