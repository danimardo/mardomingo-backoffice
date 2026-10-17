// W21 · `/panel/comprar/[paymentId]` (contracts/web-routes.md W21; BE-FR-25 CA4, UX-05). Solo ve su propia compra: una ajena es
// un 404, no un 403, para no revelar que existe. `?estado=repetida` avisa de que la compra ya estaba completada.
import { error, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor, reportDenial } from '$lib/server/features/accounts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params, setHeaders, url }) => {
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
	const purchase = composition.payments.purchaseOf(access.user.id, params.paymentId);
	if (purchase === undefined) error(404);
	const balance = composition.credits.getBalance(access.user.id);

	return {
		purchase,
		balanceMicro: balance.totalMicro,
		repeated: url.searchParams.get('estado') === 'repetida'
	};
};
