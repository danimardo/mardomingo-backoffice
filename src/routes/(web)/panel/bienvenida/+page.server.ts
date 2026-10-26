// W19 · `/panel/bienvenida` (contracts/web-routes.md W19; BE-FR-64 CA2, BE-FR-11 CA1, BE-FR-12). Tras verificar. Los pasos
// siguientes son los genéricos mientras no haya app de origen con texto propio (`apps.post_verify_text`, L04/L05). La
// bienvenida sale con su importe y su caducidad, o con la explicación si la forma del email ya la recibió.
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { accessFor, reportDenial, signupAppIdOf } from '$lib/server/features/accounts';
import { getComposition } from '$lib/server/composition.cache';
import { postVerifyTextOf } from '$lib/server/features/apps';
import { welcomeDto } from '$lib/server/features/credits';
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
	const welcome = composition.credits.welcomeOf(access.user.id);
	// BE-FR-64 CA2: el paso siguiente es el texto propio de la app de origen, si la tiene.
	const signupAppId = signupAppIdOf(composition.db, access.user.id);
	const origin = signupAppId === null ? undefined : postVerifyTextOf(composition.apps, signupAppId);
	return {
		email: access.user.email,
		nextSteps: { appName: origin?.name ?? null, customText: origin?.postVerifyText ?? null },
		welcome: welcomeDto({
			amountMicro: welcome?.amountMicro ?? null,
			expiresAt: welcome?.expiresAt ?? null
		})
	};
};
