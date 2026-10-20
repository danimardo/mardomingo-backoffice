// W36 · `/admin/usuarios/[userId]/ajuste` (contracts/web-routes.md W36; BE-FR-18, D-16, BE-FR-55; T307). Ajuste manual del saldo con
// vista previa: `previsualizarAjuste` no cambia nada; `ajustarSaldo` solo con `confirmado=true`. Un ingreso liquida primero la deuda; una resta
// nunca supera el disponible y nunca crea deuda. El motivo es obligatorio (1–500). Requiere rol de administrador.
import { error, fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor, accountView } from '$lib/server/features/accounts';
import { isConfirmed } from '$lib/server/forms/confirmation';
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
	readonly amountMicro: number;
	readonly expiresAt: number | null;
	readonly reason: string;
}

/** Lee el formulario. Un error de importe o de motivo devuelve el campo con su texto de clave. */
/** Texto de un campo del formulario; vacío si no es texto. */
function textOf(form: FormData, key: string): string {
	const value = form.get(key);
	return typeof value === 'string' ? value : '';
}

function parse(
	form: FormData,
	nowMs: number
): { ok: true; value: Parsed } | { ok: false; errors: Record<string, string> } {
	const errors: Record<string, string> = {};
	const credits = Number(form.get('cantidad'));
	if (!Number.isInteger(credits) || credits <= 0) errors.amountCredits = 'validation_invalid';
	const direction = form.get('tipo') === 'debit' ? 'debit' : 'credit';
	const kind = form.get('bolsa') === 'paid' ? 'paid' : 'free';
	const reason = textOf(form, 'motivo').trim();
	if (reason === '' || reason.length > MAX_REASON) errors.motivo = 'validation_required';
	let expiresAt: number | null = null;
	if (direction === 'credit' && kind === 'free') {
		const day = textOf(form, 'vence');
		const ms = /^\d{4}-\d{2}-\d{2}$/.test(day) ? Date.parse(`${day}T23:59:59Z`) : Number.NaN;
		if (Number.isNaN(ms) || ms <= nowMs) errors.vence = 'validation_invalid';
		else expiresAt = ms;
	}
	if (Object.keys(errors).length > 0) return { ok: false, errors };
	return {
		ok: true,
		value: { direction, kind, amountMicro: toMicro(credits * 1_000_000), expiresAt, reason }
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
	return {
		adjustmentKey,
		account,
		balance: {
			totalMicro: balance.totalMicro,
			debtMicro: balance.debtMicro,
			availableMicro: balance.availableMicro
		}
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
		const parsed = parse(form, getComposition().clock.now());
		if (!parsed.ok) return fail(400, { errors: parsed.errors, values: submitted(form) });
		const balance = getComposition().credits.getBalance(params.userId);
		const preview = previewAdjustment({
			direction: parsed.value.direction,
			amountMicro: parsed.value.amountMicro,
			balanceMicro: balance.totalMicro,
			debtMicro: balance.debtMicro,
			availableMicro: balance.availableMicro
		});
		if (!preview.ok)
			return fail(400, {
				errors: { amountCredits: 'validation_invalid' },
				values: submitted(form)
			});
		return {
			preview: { ...preview, direction: parsed.value.direction, kind: parsed.value.kind },
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
			// Un reenvío del mismo formulario ya se aplicó: se responde como éxito sin repetir el cambio.
			if (!outcome.ok && outcome.reason === 'exceeds_available')
				return fail(400, {
					errors: { amountCredits: 'validation_invalid' },
					values: submitted(form)
				});
		} catch (cause) {
			if (cause instanceof AppError) return failureOf(cause);
			throw cause;
		}
		// El aviso va en la ficha de la cuenta; la auditoría del ajuste la escribe `credits` en la misma transacción.
		const target = `${resolve('/admin/usuarios')}/${encodeURIComponent(params.userId)}`;
		const next = `${target}?aviso=ajuste_aplicado`;
		redirect(303, next);
	}
};
