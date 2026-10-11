// W19 · `/panel/bienvenida` (contracts/web-routes.md W19; BE-FR-64 CA2, BE-FR-11 CA1). Tras verificar. Los pasos
// siguientes son los genéricos mientras no haya app de origen con texto propio (`apps.post_verify_text`, L04/L05).
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { accessFor } from '$lib/server/features/accounts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, setHeaders, url }) => {
	const access = accessFor(locals.user, 'verified');
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
	return { email: access.user.email, nextSteps: { appName: null, customText: null } };
};
