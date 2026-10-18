// W38 · `/admin/economia` (contracts/web-routes.md W38; BE-FR-61, BE-FR-73, BE-FR-87; T309). Parámetros económicos globales, tipo de cambio
// manual y precio orientativo manual por operación. Cada cambio pide motivo y confirmación y queda en la auditoría. Los parámetros se
// validan con su esquema (`apps.updateSetting`). Requiere rol de administrador.
import { error, fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor } from '$lib/server/features/accounts';
import { getSetting, updateSetting } from '$lib/server/features/apps';
import {
	clearManualFx,
	getCurrentFxRate,
	setManualFx,
	setManualPrice
} from '$lib/server/features/pricing';
import { isConfirmed } from '$lib/server/forms/confirmation';
import { AppError } from '$lib/server/shared/errors';
import { failureOf } from '$lib/server/web/actions';
import type { Actions, PageServerLoad } from './$types';

/** Parámetros económicos que W38 muestra y puede cambiar (BE-FR-61; §9). */
const ECONOMY_KEYS = Object.freeze([
	'min_balance_to_operate',
	'max_debt',
	'daily_cap_no_purchase',
	'hold_ttl_seconds',
	'global_daily_free_cost_brake_eur',
	'openrouter_balance_alert_usd',
	'model_price_change_alert_pct',
	'price_reference_window_days',
	'price_reference_min_samples'
] as const);

type EconomyKey = (typeof ECONOMY_KEYS)[number];

/** `true` si la clave es de las que W38 permite cambiar. Estrecha el tipo sin aserciones. */
function isEconomyKey(value: string): value is EconomyKey {
	return ECONOMY_KEYS.some((key) => key === value);
}

/** Vuelta a la vista tras cada acción: la ruta se resuelve una vez y `redirect` recibe la variable. */
const back = resolve('/admin/economia');

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

function valueText(value: unknown): string {
	return typeof value === 'number' || typeof value === 'string' ? String(value) : '';
}

export const load: PageServerLoad = ({ locals, setHeaders }) => {
	adminOrThrow(locals);
	setHeaders({ 'cache-control': 'private, no-store' });
	const composition = getComposition();
	const fx = getCurrentFxRate(composition.pricing);
	return {
		settings: ECONOMY_KEYS.map((key) => ({
			key,
			value: valueText(getSetting(composition.apps, key))
		})),
		fx: { usdEurPpm: fx.usdEurPpm, source: fx.source, effectiveFrom: fx.effectiveFrom }
	};
};

export const actions: Actions = {
	guardarParametro: async ({ locals, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		if (!isConfirmed(form)) return fail(400, { formError: 'VALIDATION_ERROR' });
		const key = textOf(form, 'clave');
		if (!isEconomyKey(key)) return fail(400, { formError: 'VALIDATION_ERROR' });
		try {
			updateSetting(getComposition().apps, {
				actorId: admin.id,
				key,
				value: Number(textOf(form, 'valor')),
				reason: textOf(form, 'motivo')
			});
		} catch (cause) {
			if (cause instanceof AppError) return failureOf(cause);
			throw cause;
		}
		redirect(303, back);
	},
	fijarTipoCambio: async ({ locals, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		if (!isConfirmed(form)) return fail(400, { formError: 'VALIDATION_ERROR' });
		try {
			setManualFx(getComposition().pricing, {
				adminId: admin.id,
				usdEurPpm: Number(textOf(form, 'usdEurPpm')),
				reason: textOf(form, 'motivo')
			});
		} catch (cause) {
			if (cause instanceof AppError) return failureOf(cause);
			throw cause;
		}
		redirect(303, back);
	},
	quitarTipoCambio: async ({ locals, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		if (!isConfirmed(form)) return fail(400, { formError: 'VALIDATION_ERROR' });
		try {
			clearManualFx(getComposition().pricing, {
				adminId: admin.id,
				reason: textOf(form, 'motivo')
			});
		} catch (cause) {
			if (cause instanceof AppError) return failureOf(cause);
			throw cause;
		}
		redirect(303, back);
	},
	precioManual: async ({ locals, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		if (!isConfirmed(form)) return fail(400, { formError: 'VALIDATION_ERROR' });
		const micro = textOf(form, 'microUsd');
		try {
			setManualPrice(getComposition().pricing, {
				adminId: admin.id,
				operationId: textOf(form, 'operacion'),
				microUsd: micro === '' ? null : Number(micro),
				reason: textOf(form, 'motivo')
			});
		} catch (cause) {
			if (cause instanceof AppError) return failureOf(cause);
			throw cause;
		}
		redirect(303, back);
	}
};
