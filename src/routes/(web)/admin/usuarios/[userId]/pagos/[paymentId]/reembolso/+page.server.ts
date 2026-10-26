// W37 · `/admin/usuarios/[userId]/pagos/[paymentId]/reembolso` (contracts/web-routes.md W37; BE-FR-27, FR-043; T308). Reembolso de una
// compra por el administrador: `previsualizar` muestra la compra sin cambiar nada; `reembolsar` aplica solo con `confirmado=true`.
// El motivo es obligatorio. El reembolso lo hace `payments.refund`, que escribe su auditoría en la misma transacción; un importe
// fuera de rango responde 400 y una compra no reembolsable, 409 PAYMENT_NOT_REFUNDABLE.
import { error, fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor } from '$lib/server/features/accounts';
import { isConfirmed } from '$lib/server/forms/confirmation';
import { failureOf } from '$lib/server/web/actions';
import { AppError } from '$lib/server/shared/errors';
import type { Actions, PageServerLoad } from './$types';

function adminOrThrow(locals: App.Locals) {
	const access = accessFor(locals.user, 'admin');
	if (access.kind === 'anonymous' || access.kind === 'blocked' || access.kind === 'unverified') {
		const login = resolve('/login');
		redirect(303, login);
	}
	if (access.kind !== 'allow') error(403);
	return access.user;
}

function textOf(form: FormData, key: string): string {
	const value = form.get(key);
	return typeof value === 'string' ? value : '';
}

/** Importe en céntimos de euro leído del formulario; nulo si no es un entero positivo. */
function centsOf(form: FormData): number | null {
	const value = Number(textOf(form, 'importe'));
	return Number.isInteger(value) && value > 0 ? value : null;
}

function purchaseOrThrow(userId: string, paymentId: string) {
	const purchase = getComposition().payments.purchaseOf(userId, paymentId);
	if (purchase === undefined) error(404);
	return purchase;
}

export const load: PageServerLoad = ({ locals, params, setHeaders }) => {
	adminOrThrow(locals);
	setHeaders({ 'cache-control': 'private, no-store' });
	const purchase = purchaseOrThrow(params.userId, params.paymentId);
	return {
		purchase: {
			packName: purchase.packName,
			priceCents: purchase.priceCents,
			creditsMicro: purchase.creditsMicro,
			status: purchase.status,
			simulated: purchase.simulated
		}
	};
};

export const actions: Actions = {
	previsualizarReembolso: async ({ locals, params, request }) => {
		adminOrThrow(locals);
		const form = await request.formData();
		const purchase = purchaseOrThrow(params.userId, params.paymentId);
		const cents = centsOf(form);
		if (cents === null) return fail(400, { errors: { importe: 'validation_invalid' } });
		const reason = textOf(form, 'motivo').trim();
		if (reason === '') return fail(400, { errors: { motivo: 'validation_required' } });
		const { creditsToWithdrawMicro, refundableEurCents } = getComposition().payments.refundPreview({
			paymentId: params.paymentId,
			amountEurCents: cents
		});
		if (cents > refundableEurCents) return fail(409, { formError: 'PAYMENT_NOT_REFUNDABLE' });
		return {
			preview: {
				packName: purchase.packName,
				refundEurCents: cents,
				priceCents: purchase.priceCents,
				creditsToWithdrawMicro,
				reason
			}
		};
	},
	reembolsar: async ({ locals, params, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		if (!isConfirmed(form)) return fail(400, { formError: 'VALIDATION_ERROR' });
		purchaseOrThrow(params.userId, params.paymentId);
		const cents = centsOf(form);
		if (cents === null) return fail(400, { errors: { importe: 'validation_invalid' } });
		try {
			getComposition().payments.refund({
				adminId: admin.id,
				paymentId: params.paymentId,
				amountEurCents: cents,
				reason: textOf(form, 'motivo')
			});
		} catch (cause) {
			if (cause instanceof AppError) return failureOf(cause);
			throw cause;
		}
		const back = `${resolve('/admin/usuarios')}/${encodeURIComponent(params.userId)}`;
		const next = `${back}?aviso=reembolso_aplicado`;
		redirect(303, next);
	}
};
