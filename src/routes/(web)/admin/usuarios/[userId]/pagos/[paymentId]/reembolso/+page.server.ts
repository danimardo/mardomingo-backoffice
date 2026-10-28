// W37 · `/admin/usuarios/[userId]/pagos/[paymentId]/reembolso` (contracts/web-routes.md W37; BE-FR-27, FR-043; T308; D01, D02, R12).
// Reembolso de una compra por el administrador: `previsualizar` muestra lo que haría sin cambiar nada; `reembolsar` aplica solo con
// `confirmado=true`. El administrador indica los créditos no consumidos a retirar (D01). En compras reales indica también el importe
// en céntimos; en compras simuladas no se pide importe (D02). El motivo es obligatorio. Cada carga del formulario genera una clave
// que impide aplicar dos veces el mismo reembolso (R12). Un importe fuera de rango responde 400 y una compra no reembolsable, 409
// PAYMENT_NOT_REFUNDABLE.
import { error, fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor } from '$lib/server/features/accounts';
import { isConfirmed } from '$lib/server/forms/confirmation';
import { failureOf } from '$lib/server/web/actions';
import { AppError } from '$lib/server/shared/errors';
import { parseDecimalEs } from '$lib/schemas/common/decimal-es';
import type { Actions, PageServerLoad } from './$types';

const KEY_PATTERN = /^[A-Za-z0-9-]{16,64}$/;
const MICRO_PER_CREDIT = 1_000_000;

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

/**
 * Créditos escritos a la española («5.250,5») a micro-créditos. Nulo si no es un número no negativo con hasta seis decimales
 * (la unidad mínima es el micro-crédito).
 */
function creditsMicroOf(form: FormData): number | null {
	const text = textOf(form, 'creditos').trim();
	const credits = parseDecimalEs(text);
	if (credits === undefined || credits < 0 || text.startsWith('-')) return null;
	const decimals = text.split(',')[1]?.length ?? 0;
	if (decimals > 6) return null;
	const micro = Math.round(credits * MICRO_PER_CREDIT);
	return Number.isSafeInteger(micro) ? micro : null;
}

interface Parsed {
	readonly amountEurCents: number;
	readonly creditsToRemoveMicro: number;
	readonly reason: string;
}

/** Lee el formulario. En compras simuladas el importe no se lee: el reembolso no devuelve dinero (D02). */
function parse(
	form: FormData,
	simulated: boolean
):
	| { readonly ok: true; readonly value: Parsed }
	| { readonly ok: false; readonly errors: Record<string, string> } {
	const amount = simulated ? 0 : centsOf(form);
	const credits = creditsMicroOf(form);
	const reason = textOf(form, 'motivo').trim();
	const errors: Record<string, string> = {};
	if (amount === null) errors.importe = 'amount_invalid';
	if (credits === null) errors.creditos = 'credits_invalid';
	if (reason === '') errors.motivo = 'validation_required';
	if (amount === null || credits === null || reason === '') return { ok: false, errors };
	return { ok: true, value: { amountEurCents: amount, creditsToRemoveMicro: credits, reason } };
}

function purchaseOrThrow(userId: string, paymentId: string) {
	const purchase = getComposition().payments.purchaseOf(userId, paymentId);
	if (purchase === undefined) error(404);
	return purchase;
}

export const load: PageServerLoad = ({ locals, params, setHeaders }) => {
	adminOrThrow(locals);
	setHeaders({ 'cache-control': 'private, no-store' });
	// Clave de este formulario: un reenvío con la misma clave no vuelve a reembolsar (R12).
	const refundKey = crypto.randomUUID();
	const purchase = purchaseOrThrow(params.userId, params.paymentId);
	return {
		refundKey,
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
		const parsed = parse(form, purchase.simulated);
		if (!parsed.ok) return fail(400, { errors: parsed.errors });
		const preview = getComposition().payments.refundPreview({
			paymentId: params.paymentId,
			amountEurCents: parsed.value.amountEurCents,
			creditsToRemoveMicro: parsed.value.creditsToRemoveMicro
		});
		if (!preview.plan.ok) {
			switch (preview.plan.reason) {
				case 'amount_not_positive':
				case 'amount_not_allowed':
					return fail(400, { errors: { importe: 'amount_invalid' } });
				case 'credits_negative':
					return fail(400, { errors: { creditos: 'credits_invalid' } });
				case 'nothing_to_refund':
					return fail(400, { errors: { creditos: 'credits_zero' } });
				default:
					return fail(409, { formError: 'PAYMENT_NOT_REFUNDABLE' });
			}
		}
		return {
			preview: {
				packName: purchase.packName,
				simulated: purchase.simulated,
				priceCents: purchase.priceCents,
				refundEurCents: parsed.value.amountEurCents,
				creditsToRemoveMicro: parsed.value.creditsToRemoveMicro,
				reason: parsed.value.reason,
				refundableEurCents: preview.refundableEurCents
			}
		};
	},
	reembolsar: async ({ locals, params, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		if (!isConfirmed(form)) return fail(400, { formError: 'VALIDATION_ERROR' });
		const purchase = purchaseOrThrow(params.userId, params.paymentId);
		const idempotencyKey = textOf(form, 'clave');
		if (!KEY_PATTERN.test(idempotencyKey)) return fail(400, { formError: 'VALIDATION_ERROR' });
		const parsed = parse(form, purchase.simulated);
		if (!parsed.ok) return fail(400, { errors: parsed.errors });
		try {
			getComposition().payments.refund({
				adminId: admin.id,
				paymentId: params.paymentId,
				amountEurCents: parsed.value.amountEurCents,
				creditsToRemoveMicro: parsed.value.creditsToRemoveMicro,
				reason: parsed.value.reason,
				idempotencyKey
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
