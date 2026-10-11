// `/panel` (contracts/web-routes.md 1.2, 1.4; W18 completo en L12). Requiere cuenta verificada: sin sesión, al inicio de
// sesión; sin verificar, a reenviar la verificación. Las páginas autenticadas no se guardan en caché.
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { accessFor, reportDenial } from '$lib/server/features/accounts';
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
	return { email: access.user.email };
};
