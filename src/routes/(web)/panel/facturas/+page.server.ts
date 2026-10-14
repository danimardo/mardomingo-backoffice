// W30 · `/panel/facturas` (contracts/web-routes.md W30; BE-FR-75, BE-FR-74). Lista de facturas de la cuenta, sin ids internos ni
// datos del proveedor. Con el proveedor `none` de la v4 la lista está vacía de forma legítima. Requiere cuenta verificada.
// La acción `?/solicitarFacturaCompleta` pide factura completa de una compra propia: exige el perfil fiscal completo (W27).
import { fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor, reportDenial } from '$lib/server/features/accounts';
import { BillingProfile } from '$lib/schemas/invoicing/billing-profile';
import { billingProfileOf } from '$lib/server/features/invoicing';
import { civilDateOf } from '$lib/shared/dates';
import { toEpochMs } from '$lib/shared/time';
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

	const composition = getComposition();
	const paymentIds = composition.payments.paymentIdsOf(access.user.id);
	const invoices = composition.invoicing.invoicesFor(paymentIds);
	const purchases = paymentIds.flatMap((id) => {
		const view = composition.payments.purchaseOf(access.user.id, id);
		if (view === undefined || view.status !== 'completed' || view.completedAt === null) return [];
		return [
			{
				id,
				label: `${civilDateOf(toEpochMs(view.completedAt))} · ${view.packName}`
			}
		];
	});
	return {
		invoices: invoices.map((invoice) => ({
			date: civilDateOf(invoice.issuedAt),
			kind: invoice.kind,
			number: `${invoice.series}-${invoice.number}`,
			amountEurCents: invoice.amountEurCents
		})),
		purchases,
		requested: url.searchParams.get('aviso') === 'full_invoice_requested'
	};
};

export const actions: Actions = {
	solicitarFacturaCompleta: async ({ request, locals }) => {
		const access = accessFor(locals.user, 'verified');
		if (access.kind !== 'allow') {
			const login = resolve('/login');
			redirect(303, login);
		}
		const form = await request.formData();
		const paymentId = form.get('paymentId');
		if (typeof paymentId !== 'string' || paymentId === '') {
			return fail(400, { formError: 'VALIDATION_ERROR' });
		}

		const composition = getComposition();
		const row = billingProfileOf(composition.db, access.user.id);
		const complete =
			row !== undefined &&
			BillingProfile.safeParse({
				kind: row.kind,
				legalName: row.legalName,
				taxId: row.taxId,
				address: row.address,
				postalCode: row.postalCode,
				city: row.city,
				country: row.country
			}).success;
		if (!complete) return fail(400, { formError: 'BILLING_PROFILE_INCOMPLETE' });

		const saved = composition.payments.requestFullInvoice({
			userId: access.user.id,
			paymentId
		});
		if (!saved) return fail(404, { formError: 'NOT_FOUND' });
		locals.log.emit('invoicing.full_invoice.requested', {});
		const done = `${resolve('/panel/facturas')}?aviso=full_invoice_requested`;
		redirect(303, done);
	}
};
