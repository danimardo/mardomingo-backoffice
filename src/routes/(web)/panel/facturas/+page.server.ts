// W30 · `/panel/facturas` (contracts/web-routes.md W30; BE-FR-75, BE-FR-74). Lista de facturas de la cuenta, sin ids internos ni
// datos del proveedor. Con el proveedor `none` de la v4 la lista está vacía de forma legítima. Requiere cuenta verificada.
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor, reportDenial } from '$lib/server/features/accounts';
import { civilDateOf } from '$lib/shared/dates';
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
	const invoices = composition.invoicing.invoicesFor(
		composition.payments.paymentIdsOf(access.user.id)
	);
	return {
		invoices: invoices.map((invoice) => ({
			date: civilDateOf(invoice.issuedAt),
			kind: invoice.kind,
			number: `${invoice.series}-${invoice.number}`,
			amountEurCents: invoice.amountEurCents
		}))
	};
};
