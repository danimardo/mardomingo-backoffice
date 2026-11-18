// W38 · `/admin/economia` (contracts/web-routes.md W38; BE-FR-61, BE-FR-73, BE-FR-87; T309). Parámetros económicos globales, tipo de cambio
// manual y precio orientativo manual por operación. Cada cambio pide motivo y confirmación y queda en la auditoría; al guardar se
// vuelve con `?aviso=saved&auditoria=<id>` y la página enlaza con esa entrada (UX-13; C-51). Los parámetros se validan con su
// esquema (`apps.updateSetting`). El tipo manual es un entero entre 500.000 y 2.000.000 ppm y tiene vista previa (C-48).
// Requiere rol de administrador.
import { error, fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor } from '$lib/server/features/accounts';
import {
	DEFAULT_SETTINGS,
	getSetting,
	previewSettingChange,
	updateSetting
} from '$lib/server/features/apps';
import { listPacksForAdmin } from '$lib/server/features/payments';
import {
	clearManualFx,
	getCurrentFxRate,
	previewManualFx,
	setManualFx,
	setManualPrice
} from '$lib/server/features/pricing';
import * as m from '$lib/paraglide/messages.js';
import { isConfirmed, savedEntryOf, savedRedirect } from '$lib/server/forms/confirmation';
import { reasonRejection } from '$lib/server/forms/reason';
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

/** Explicación de un parámetro para la ficha. Son borradores pendientes de revisión: se marcan como tales en el texto. */
function explanationOf(key: EconomyKey): string {
	switch (key) {
		case 'min_balance_to_operate':
			return m.admin_economy_explain_min_balance_to_operate();
		case 'max_debt':
			return m.admin_economy_explain_max_debt();
		case 'daily_cap_no_purchase':
			return m.admin_economy_explain_daily_cap_no_purchase();
		case 'hold_ttl_seconds':
			return m.admin_economy_explain_hold_ttl_seconds();
		case 'global_daily_free_cost_brake_eur':
			return m.admin_economy_explain_global_daily_free_cost_brake_eur();
		case 'openrouter_balance_alert_usd':
			return m.admin_economy_explain_openrouter_balance_alert_usd();
		case 'model_price_change_alert_pct':
			return m.admin_economy_explain_model_price_change_alert_pct();
		case 'price_reference_window_days':
			return m.admin_economy_explain_price_reference_window_days();
		case 'price_reference_min_samples':
			return m.admin_economy_explain_price_reference_min_samples();
	}
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

/** Tipo manual escrito en ppm: solo cifras. Cualquier otra cosa (vacío, decimal, signo, exponente) es NaN y no pasa (C-48). */
function fxPpmOf(form: FormData): number {
	const text = textOf(form, 'usdEurPpm').trim();
	return /^\d{1,10}$/.test(text) ? Number(text) : Number.NaN;
}

const EUR_PER_USD = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 6 });

/** Un tipo en ppm como euros por dólar a la española (920.000 → «0,92»). */
function eurPerUsdOf(ppm: number): string {
	return EUR_PER_USD.format(ppm / 1_000_000);
}

/** Formulario del tipo manual en la página (vista previa y confirmación comparten campo de motivo). */
const FX_SCOPE = 'tipoCambioManual';

/** Error de un campo del tipo manual (C-48): el tipo fuera de rango o el motivo vacío, con lo escrito para no perderlo. */
function fxFailure(cause: AppError, values: Readonly<Record<string, string>>) {
	if (cause.code === 'VALIDATION_ERROR' && cause.details.field === 'usdEurPpm') {
		return fail(400, { errors: { usdEurPpm: 'fx_out_of_range' }, values, scope: FX_SCOPE });
	}
	if (cause.code === 'VALIDATION_ERROR' && cause.details.field === 'reason') {
		return fail(400, { errors: { motivo: 'validation_required' }, values, scope: FX_SCOPE });
	}
	return failureOf(cause, values);
}

export const load: PageServerLoad = ({ locals, setHeaders, url }) => {
	adminOrThrow(locals);
	setHeaders({ 'cache-control': 'private, no-store' });
	const composition = getComposition();
	const fx = getCurrentFxRate(composition.pricing);
	return {
		settings: ECONOMY_KEYS.map((key) => ({
			key,
			value: valueText(getSetting(composition.apps, key)),
			// Parámetros globales: el origen es siempre «global»; las sobrescrituras por app viven en W40.
			defaultValue: valueText(DEFAULT_SETTINGS[key]),
			explanation: explanationOf(key),
			origin: 'global' as const
		})),
		fx: { usdEurPpm: fx.usdEurPpm, source: fx.source, effectiveFrom: fx.effectiveFrom },
		packs: listPacksForAdmin({ db: composition.db }),
		// Aviso tras un cambio aplicado: enlaza con su entrada de auditoría (UX-13).
		saved: savedEntryOf(url)
	};
};

export const actions: Actions = {
	previsualizarParametros: async ({ locals, request }) => {
		adminOrThrow(locals);
		const form = await request.formData();
		const key = textOf(form, 'clave');
		if (!isEconomyKey(key)) return fail(400, { formError: 'VALIDATION_ERROR' });
		const preview = previewSettingChange(getComposition().apps, key, Number(textOf(form, 'valor')));
		return { preview };
	},
	guardarParametros: async ({ locals, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		if (!isConfirmed(form)) return fail(400, { formError: 'VALIDATION_ERROR' });
		const key = textOf(form, 'clave');
		if (!isEconomyKey(key)) return fail(400, { formError: 'VALIDATION_ERROR' });
		// Motivo de 1 a 500 caracteres (C-55): el error va al formulario de ese parámetro.
		const rejected = reasonRejection(textOf(form, 'motivo'), { scope: `guardarParametros:${key}` });
		if (rejected !== null) return rejected;
		let entryId: string;
		try {
			entryId = updateSetting(getComposition().apps, {
				actorId: admin.id,
				key,
				value: Number(textOf(form, 'valor')),
				reason: textOf(form, 'motivo')
			});
		} catch (cause) {
			if (cause instanceof AppError) return failureOf(cause);
			throw cause;
		}
		const next = savedRedirect(back, entryId);
		redirect(303, next);
	},
	// Vista previa del tipo manual (C-48): el vigente y el nuevo, sin escribir nada. La confirmación la hace su formulario.
	previsualizarTipoCambioManual: async ({ locals, request }) => {
		adminOrThrow(locals);
		const form = await request.formData();
		const values = { usdEurPpm: textOf(form, 'usdEurPpm'), motivo: textOf(form, 'motivo') };
		try {
			const preview = previewManualFx(getComposition().pricing, fxPpmOf(form));
			// La vista previa ya rechaza el motivo que la confirmación rechazaría (C-55).
			const rejected = reasonRejection(values.motivo, { scope: FX_SCOPE, values });
			if (rejected !== null) return rejected;
			return {
				fxPreview: {
					beforePpm: preview.beforePpm,
					beforeEur: eurPerUsdOf(preview.beforePpm),
					afterPpm: preview.afterPpm,
					afterEur: eurPerUsdOf(preview.afterPpm),
					reason: values.motivo
				}
			};
		} catch (cause) {
			if (cause instanceof AppError) return fxFailure(cause, values);
			throw cause;
		}
	},
	fijarTipoCambioManual: async ({ locals, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		if (!isConfirmed(form)) return fail(400, { formError: 'VALIDATION_ERROR' });
		const values = { usdEurPpm: textOf(form, 'usdEurPpm'), motivo: textOf(form, 'motivo') };
		const rejected = reasonRejection(values.motivo, { scope: FX_SCOPE, values });
		if (rejected !== null) return rejected;
		let entryId: string;
		try {
			entryId = setManualFx(getComposition().pricing, {
				adminId: admin.id,
				usdEurPpm: fxPpmOf(form),
				reason: values.motivo
			});
		} catch (cause) {
			if (cause instanceof AppError) return fxFailure(cause, values);
			throw cause;
		}
		const next = savedRedirect(back, entryId);
		redirect(303, next);
	},
	quitarTipoCambioManual: async ({ locals, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		if (!isConfirmed(form)) return fail(400, { formError: 'VALIDATION_ERROR' });
		const rejected = reasonRejection(textOf(form, 'motivo'), { scope: 'quitarTipoCambioManual' });
		if (rejected !== null) return rejected;
		let outcome: ReturnType<typeof clearManualFx>;
		try {
			outcome = clearManualFx(getComposition().pricing, {
				adminId: admin.id,
				reason: textOf(form, 'motivo')
			});
		} catch (cause) {
			if (cause instanceof AppError) return failureOf(cause);
			throw cause;
		}
		// Sin valor del BCE al que volver no se cambia nada ni se audita: vuelve sin aviso.
		const next = outcome.ok ? savedRedirect(back, outcome.entryId) : back;
		redirect(303, next);
	},
	guardarPrecioOrientativo: async ({ locals, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		if (!isConfirmed(form)) return fail(400, { formError: 'VALIDATION_ERROR' });
		const micro = textOf(form, 'microUsd');
		const rejected = reasonRejection(textOf(form, 'motivo'), {
			scope: 'guardarPrecioOrientativo',
			values: { operacion: textOf(form, 'operacion'), microUsd: micro }
		});
		if (rejected !== null) return rejected;
		let entryId: string;
		try {
			entryId = setManualPrice(getComposition().pricing, {
				adminId: admin.id,
				operationId: textOf(form, 'operacion'),
				microUsd: micro === '' ? null : Number(micro),
				reason: textOf(form, 'motivo')
			});
		} catch (cause) {
			if (cause instanceof AppError) return failureOf(cause);
			throw cause;
		}
		const next = savedRedirect(back, entryId);
		redirect(303, next);
	}
};
