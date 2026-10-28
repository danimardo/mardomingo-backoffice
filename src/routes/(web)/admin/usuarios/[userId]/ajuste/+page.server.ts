// W36 · `/admin/usuarios/[userId]/ajuste` (contracts/web-routes.md W36; BE-FR-18, D-16, BE-FR-55; T307). Ajuste manual del saldo con
// vista previa: `previsualizarAjuste` no cambia nada; `ajustarSaldo` solo con `confirmado=true`. Un ingreso liquida primero la deuda; una resta
// nunca supera el disponible del tipo elegido ni el disponible total, y nunca crea deuda. El motivo es obligatorio (1–500). Reglas de la
// propuesta de administración: un ajuste admite como máximo 100 000 créditos (R04); la caducidad de una bolsa gratuita es de Madrid y como
// mucho a 365 días (R05); y una cuenta bloqueada admite solo restas (R07). Requiere rol de administrador.
import { error, fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor, accountView } from '$lib/server/features/accounts';
import { getSetting } from '$lib/server/features/apps';
import {
	adjustmentCreditsFit,
	blockedAdjustmentAllowed,
	debitFitsKind,
	eurCentsOfCredits,
	freeExpiryOf
} from '$lib/server/features/credits';
import { isConfirmed, savedRedirect } from '$lib/server/forms/confirmation';
import { previewAdjustment } from '$lib/server/web/balance-adjustment';
import { failureOf } from '$lib/server/web/actions';
import { AppError } from '$lib/server/shared/errors';
import { toMicro } from '$lib/shared/money';
import { toEpochMs } from '$lib/shared/time';
import type { Actions, PageServerLoad } from './$types';

const MAX_REASON = 500;
const KEY_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

function adminOrThrow(locals: App.Locals) {
	const access = accessFor(locals.user, 'admin');
	if (access.kind === 'anonymous' || access.kind === 'blocked' || access.kind === 'unverified') {
		const login = resolve('/login');
		redirect(303, login);
	}
	if (access.kind !== 'allow') error(403);
	return access.user;
}

interface Parsed {
	readonly direction: 'credit' | 'debit';
	readonly kind: 'free' | 'paid';
	readonly credits: number;
	readonly amountMicro: number;
	readonly expiresAt: number | null;
	readonly reason: string;
}

/** Texto de un campo del formulario; vacío si no es texto. */
function textOf(form: FormData, key: string): string {
	const value = form.get(key);
	return typeof value === 'string' ? value : '';
}

/** Código del campo de importe: entero mayor que cero (`amount_invalid`), o por encima del tope (`amount_over_max`). */
function amountCodeOf(credits: number): string {
	return Number.isInteger(credits) && credits > 0 ? 'amount_over_max' : 'amount_invalid';
}

/** Código del campo de caducidad, según el motivo que devuelve `freeExpiryOf`. */
function expiryCodeOf(reason: 'invalid' | 'past' | 'beyond_horizon'): string {
	switch (reason) {
		case 'past':
			return 'expiry_past';
		case 'beyond_horizon':
			return 'expiry_too_far';
		case 'invalid':
			return 'expiry_invalid';
	}
}

/** Lee el formulario. Un error de importe, de caducidad o de motivo devuelve el campo con su código; el texto lo pone la página. */
function parse(
	form: FormData,
	nowMs: number
): { ok: true; value: Parsed } | { ok: false; errors: Record<string, string> } {
	const errors: Record<string, string> = {};
	const credits = Number(form.get('cantidad'));
	if (!adjustmentCreditsFit(credits)) errors.amountCredits = amountCodeOf(credits);
	const direction = form.get('tipo') === 'debit' ? 'debit' : 'credit';
	const kind = form.get('bolsa') === 'paid' ? 'paid' : 'free';
	const reason = textOf(form, 'motivo').trim();
	if (reason === '') errors.motivo = 'validation_required';
	else if (reason.length > MAX_REASON) errors.motivo = 'reason_too_long';
	let expiresAt: number | null = null;
	if (direction === 'credit' && kind === 'free') {
		const verdict = freeExpiryOf(textOf(form, 'vence'), nowMs);
		if (verdict.ok) expiresAt = verdict.expiresAt;
		else errors.vence = expiryCodeOf(verdict.reason);
	}
	if (Object.keys(errors).length > 0) return { ok: false, errors };
	return {
		ok: true,
		value: {
			direction,
			kind,
			credits,
			amountMicro: toMicro(credits * 1_000_000),
			expiresAt,
			reason
		}
	};
}

export const load: PageServerLoad = ({ locals, params, setHeaders }) => {
	adminOrThrow(locals);
	setHeaders({ 'cache-control': 'private, no-store' });
	const composition = getComposition();
	// Clave de este formulario: un reenvío con la misma clave no vuelve a aplicar el ajuste (T307, 15.12).
	const adjustmentKey = crypto.randomUUID();
	const account = accountView(composition.adminUsers, params.userId);
	if (account === null || account.deleted) error(404);
	const balance = composition.credits.getBalance(params.userId);
	const adjustable = composition.credits.adjustableByKind(params.userId);
	return {
		adjustmentKey,
		account,
		balance: {
			totalMicro: balance.totalMicro,
			debtMicro: balance.debtMicro,
			availableMicro: balance.availableMicro
		},
		adjustable
	};
};

/** Valores enviados, para volver a pintarlos si la respuesta no aplica el ajuste (la página se recarga entera). */
function submitted(form: FormData) {
	return {
		cantidad: textOf(form, 'cantidad'),
		tipo: textOf(form, 'tipo'),
		bolsa: textOf(form, 'bolsa'),
		vence: textOf(form, 'vence'),
		motivo: textOf(form, 'motivo')
	};
}

export const actions: Actions = {
	previsualizarAjuste: async ({ locals, params, request }) => {
		adminOrThrow(locals);
		const form = await request.formData();
		const composition = getComposition();
		const parsed = parse(form, composition.clock.now());
		if (!parsed.ok) return fail(400, { errors: parsed.errors, values: submitted(form) });
		const account = accountView(composition.adminUsers, params.userId);
		if (account === null || account.deleted) error(404);
		if (!blockedAdjustmentAllowed(parsed.value.direction, account.banned))
			return fail(400, { formError: 'BLOCKED_ACCOUNT_CREDIT', values: submitted(form) });
		const balance = composition.credits.getBalance(params.userId);
		const preview = previewAdjustment({
			direction: parsed.value.direction,
			amountMicro: parsed.value.amountMicro,
			balanceMicro: balance.totalMicro,
			debtMicro: balance.debtMicro,
			availableMicro: balance.availableMicro
		});
		if (!preview.ok)
			return fail(400, {
				errors: {
					amountCredits:
						preview.reason === 'exceeds_available' ? 'amount_exceeds_available' : 'amount_invalid'
				},
				values: submitted(form)
			});
		// La vista previa promete lo mismo que luego cumple `credits.adjust`: una resta cabe en el disponible del tipo elegido (R06).
		const adjustable = composition.credits.adjustableByKind(params.userId);
		const kindMicro = parsed.value.kind === 'free' ? adjustable.freeMicro : adjustable.paidMicro;
		if (parsed.value.direction === 'debit' && !debitFitsKind(parsed.value.amountMicro, kindMicro))
			return fail(400, {
				errors: { amountCredits: 'amount_exceeds_kind' },
				values: submitted(form)
			});
		// Equivalente en euros al precio de compra (R04); sin ajuste de precio válido no se muestra.
		const creditsPerEur = Number(getSetting(composition.apps, 'credits_per_eur_purchase'));
		const eurCents =
			Number.isFinite(creditsPerEur) && creditsPerEur > 0
				? eurCentsOfCredits(parsed.value.credits, creditsPerEur)
				: null;
		return {
			preview: {
				...preview,
				direction: parsed.value.direction,
				kind: parsed.value.kind,
				eurCents
			},
			values: submitted(form)
		};
	},
	ajustarSaldo: async ({ locals, params, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		if (!isConfirmed(form))
			return fail(400, { formError: 'VALIDATION_ERROR', values: submitted(form) });
		const idempotencyKey = textOf(form, 'clave');
		if (!KEY_PATTERN.test(idempotencyKey))
			return fail(400, { formError: 'VALIDATION_ERROR', values: submitted(form) });
		const composition = getComposition();
		const parsed = parse(form, composition.clock.now());
		if (!parsed.ok) return fail(400, { errors: parsed.errors, values: submitted(form) });
		const account = accountView(composition.adminUsers, params.userId);
		if (account === null || account.deleted) error(404);
		if (!blockedAdjustmentAllowed(parsed.value.direction, account.banned))
			return fail(400, { formError: 'BLOCKED_ACCOUNT_CREDIT', values: submitted(form) });
		let auditId: string | null = null;
		try {
			const outcome = composition.credits.adjust({
				adminId: admin.id,
				userId: params.userId,
				direction: parsed.value.direction,
				kind: parsed.value.kind,
				amountMicro: parsed.value.amountMicro,
				expiresAt: parsed.value.expiresAt === null ? null : toEpochMs(parsed.value.expiresAt),
				reason: parsed.value.reason,
				idempotencyKey
			});
			if (outcome.ok) auditId = outcome.auditId;
			// Una resta que no cabe en el disponible total o en el del tipo elegido se rechaza sin escribir nada.
			if (
				!outcome.ok &&
				(outcome.reason === 'exceeds_available' || outcome.reason === 'exceeds_kind')
			)
				return fail(400, {
					errors: {
						amountCredits:
							outcome.reason === 'exceeds_kind' ? 'amount_exceeds_kind' : 'amount_exceeds_available'
					},
					values: submitted(form)
				});
		} catch (cause) {
			if (cause instanceof AppError) return failureOf(cause);
			throw cause;
		}
		// El aviso va en la ficha de la cuenta; la auditoría del ajuste la escribe `credits` en la misma transacción.
		const target = `${resolve('/admin/usuarios')}/${encodeURIComponent(params.userId)}`;
		// Un reenvío ya aplicado no tiene entrada nueva: vuelve a la ficha sin aviso.
		const next = auditId === null ? target : savedRedirect(target, auditId);
		redirect(303, next);
	}
};
