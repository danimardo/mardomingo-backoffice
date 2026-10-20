// W44 · `/admin/protecciones` (contracts/web-routes.md W44; BE-FR-43, BE-FR-46, BE-FR-53; T313). Límites globales de protección y el
// freno de coste diario. Cambiar un límite pasa por `apps.updateSetting`, que valida, respeta los techos y audita antes y después.
// Liberar el freno exige confirmación y motivo, y queda en la auditoría. Requiere rol de administrador.
import { error, fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor } from '$lib/server/features/accounts';
import { getSetting, previewSettingChange, updateSetting } from '$lib/server/features/apps';
import { brakeStatus, releaseBrake } from '$lib/server/features/protections';
import { isConfirmed } from '$lib/server/forms/confirmation';
import { AppError } from '$lib/server/shared/errors';
import { failureOf } from '$lib/server/web/actions';
import type { Actions, PageServerLoad } from './$types';

/** Límites de protección que W44 muestra y puede cambiar (BE-FR-43, BE-FR-46, BE-FR-53). */
const PROTECTION_LIMITS = Object.freeze([
	'registrations_per_ip_24h',
	'login_max_failures',
	'login_lock_minutes',
	'login_per_ip_15min',
	'resend_verification_per_ip_hour',
	'password_reset_per_ip_hour',
	'ai_requests_per_minute',
	'max_concurrent_transcriptions',
	'global_daily_free_cost_brake_eur'
] as const);

/** `true` si la clave es uno de los límites que W44 permite cambiar. Estrecha el tipo sin aserciones. */
function isLimitKey(value: string): value is (typeof PROTECTION_LIMITS)[number] {
	return PROTECTION_LIMITS.some((key) => key === value);
}

function adminOrThrow(locals: App.Locals) {
	const access = accessFor(locals.user, 'admin');
	if (access.kind === 'anonymous' || access.kind === 'blocked' || access.kind === 'unverified') {
		const login = resolve('/login');
		redirect(303, login);
	}
	if (access.kind !== 'allow') error(403);
	return access.user;
}

/** Valor de un ajuste como texto para el formulario; vacío si no es número ni texto. */
function valueText(value: unknown): string {
	return typeof value === 'number' || typeof value === 'string' ? String(value) : '';
}

function textOf(form: FormData, key: string): string {
	const value = form.get(key);
	return typeof value === 'string' ? value : '';
}

export const load: PageServerLoad = ({ locals, setHeaders }) => {
	adminOrThrow(locals);
	setHeaders({ 'cache-control': 'private, no-store' });
	const composition = getComposition();
	return {
		brake: brakeStatus(composition.brake),
		limits: PROTECTION_LIMITS.map((key) => ({
			key,
			value: valueText(getSetting(composition.apps, key))
		}))
	};
};

export const actions: Actions = {
	previsualizarLimites: async ({ locals, request }) => {
		adminOrThrow(locals);
		const form = await request.formData();
		const key = textOf(form, 'clave');
		if (!isLimitKey(key)) return fail(400, { formError: 'VALIDATION_ERROR' });
		const preview = previewSettingChange(getComposition().apps, key, Number(textOf(form, 'valor')));
		return { preview };
	},
	guardarLimites: async ({ locals, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		if (!isConfirmed(form)) return fail(400, { formError: 'VALIDATION_ERROR' });
		const key = textOf(form, 'clave');
		if (!isLimitKey(key)) return fail(400, { formError: 'VALIDATION_ERROR' });
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
		const back = resolve('/admin/protecciones');
		redirect(303, back);
	},
	liberarFreno: async ({ locals, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		if (!isConfirmed(form)) return fail(400, { formError: 'VALIDATION_ERROR' });
		const reason = textOf(form, 'motivo').trim();
		if (reason === '') return fail(400, { errors: { motivo: 'validation_required' } });
		releaseBrake(getComposition().brake, admin.id);
		const back = resolve('/admin/protecciones');
		redirect(303, back);
	}
};
