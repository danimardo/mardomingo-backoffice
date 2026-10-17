// W29 · `/panel/perfil/borrar` (contracts/web-routes.md W29; BE-FR-07, UX-07; T285). Muestra lo que se pierde (saldo en créditos y
// en euros, sin reembolso) y a qué apps afecta, y borra la cuenta con la contraseña y la casilla marcada. Requiere cuenta
// verificada. Al borrar, la sesión y su cookie desaparecen y se redirige a `/cuenta-borrada`. La lógica está en
// `$lib/server/web/delete-account.ts`; aquí solo se traduce a `redirect` o `fail`.
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor, reportDenial } from '$lib/server/features/accounts';
import { deleteAccountView, submitDeleteAccount } from '$lib/server/web/delete-account';
import type { Actions, PageServerLoad } from './$types';

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
	return deleteAccountView(getComposition(), access.user.id);
};

export const actions: Actions = {
	borrarCuenta: async ({ request, locals }) => {
		const result = await submitDeleteAccount(
			getComposition(),
			locals.user,
			await request.formData(),
			request.headers
		);
		if (result.kind === 'denied') {
			const login = resolve('/login');
			redirect(303, login);
		}
		if (result.kind === 'failure') return result.failure;
		const done = resolve('/cuenta-borrada');
		redirect(303, done);
	}
};
