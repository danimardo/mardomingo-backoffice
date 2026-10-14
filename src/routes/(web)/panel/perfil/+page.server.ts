// W27 · `/panel/perfil` (contracts/web-routes.md W27; T266, BE-FR-06). Muestra el email de la cuenta y permite cambiar la contraseña
// con la actual. Cambiar el email queda fuera de esta versión: exige su propio flujo de confirmación (pendiente de decisión).
// Requiere cuenta verificada. La acción revoca las demás sesiones (Better Auth) y avisa en la misma página.
import { fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor, reportDenial } from '$lib/server/features/accounts';
import { billingProfileOf } from '$lib/server/features/invoicing';
import { ChangeEmailSchema } from '$lib/schemas/accounts/change-email';
import { LowBalanceAlertSchema, thresholdMicroOf } from '$lib/schemas/accounts/low-balance-alert';
import { BillingProfile } from '$lib/schemas/invoicing/billing-profile';
import { AppError } from '$lib/server/shared/errors';
import { clientIpOf, failureOf } from '$lib/server/web/actions';
import { parseForm } from '$lib/server/forms';
import { ChangePasswordSchema } from '$lib/schemas/accounts/change-password';
import type { Actions, PageServerLoad } from './$types';

function billingFormOf(userId: string): Readonly<Record<string, string>> {
	const profile = billingProfileOf(getComposition().db, userId);
	if (profile === undefined) return {};
	return {
		kind: profile.kind,
		legalName: profile.legalName,
		taxId: profile.taxId,
		address: profile.address,
		postalCode: profile.postalCode,
		city: profile.city,
		country: profile.country
	};
}

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
	return {
		email: access.user.email,
		passwordChanged: url.searchParams.get('aviso') === 'password_changed',
		emailSent: url.searchParams.get('aviso') === 'email_sent',
		saved: url.searchParams.get('aviso') ?? null,
		threshold: getComposition().credits.lowBalance(access.user.id).thresholdMicro,
		billing: billingFormOf(access.user.id)
	};
};

export const actions: Actions = {
	guardarAvisoSaldo: async ({ request, locals }) => {
		const access = accessFor(locals.user, 'verified');
		if (access.kind !== 'allow') {
			const login = resolve('/login');
			redirect(303, login);
		}
		const parsed = parseForm(LowBalanceAlertSchema, await request.formData());
		if (!parsed.ok) return parsed.failure;

		getComposition().credits.setLowBalanceThreshold({
			userId: access.user.id,
			thresholdMicro: thresholdMicroOf(parsed.data.threshold)
		});
		const done = `${resolve('/panel/perfil')}?aviso=threshold_saved`;
		redirect(303, done);
	},
	guardarDatosFiscales: async ({ request, locals }) => {
		const access = accessFor(locals.user, 'verified');
		if (access.kind !== 'allow') {
			const login = resolve('/login');
			redirect(303, login);
		}
		const form = await request.formData();
		const text = (key: string): string => {
			const value = form.get(key);
			return typeof value === 'string' ? value : '';
		};
		const profile = {
			kind: text('kind'),
			legalName: text('legalName'),
			taxId: text('taxId'),
			address: text('address'),
			postalCode: text('postalCode'),
			city: text('city'),
			country: text('country')
		};
		const checked = BillingProfile.safeParse(profile);
		if (!checked.success) {
			const reason = checked.error.issues[0]?.message ?? 'invoicing_profile_invalid';
			return fail(400, { billingError: reason, billingValues: profile });
		}
		const outcome = getComposition().invoicing.saveBillingProfile({
			userId: access.user.id,
			profile: checked.data
		});
		if (outcome.status === 'rejected') {
			return fail(400, { billingError: outcome.reason, billingValues: profile });
		}
		const done = `${resolve('/panel/perfil')}?aviso=billing_saved`;
		redirect(303, done);
	},
	cambiarEmail: async ({ request, locals, getClientAddress }) => {
		const access = accessFor(locals.user, 'verified');
		if (access.kind !== 'allow') {
			const login = resolve('/login');
			redirect(303, login);
		}
		const parsed = parseForm(ChangeEmailSchema, await request.formData());
		if (!parsed.ok) return parsed.failure;

		let outcome;
		try {
			outcome = await getComposition().accounts.requestEmailChange({
				userId: access.user.id,
				currentPassword: parsed.data.currentPassword,
				newEmail: parsed.data.newEmail,
				remoteIp: clientIpOf(getClientAddress)
			});
		} catch (error) {
			if (error instanceof AppError) return failureOf(error);
			throw error;
		}
		if (outcome === 'wrong_password') {
			return fail(400, { errors: { currentPassword: 'validation_invalid' }, values: {} });
		}
		const done = `${resolve('/panel/perfil')}?aviso=email_sent`;
		redirect(303, done);
	},
	cambiarContrasena: async ({ request, locals }) => {
		const access = accessFor(locals.user, 'verified');
		if (access.kind !== 'allow') {
			const login = resolve('/login');
			redirect(303, login);
		}
		const parsed = parseForm(ChangePasswordSchema, await request.formData());
		if (!parsed.ok) return parsed.failure;

		const outcome = await getComposition().accounts.changePassword(request.headers, {
			currentPassword: parsed.data.currentPassword,
			newPassword: parsed.data.newPassword
		});
		if (outcome === 'wrong_password') {
			return fail(400, { errors: { currentPassword: 'validation_invalid' }, values: {} });
		}
		const done = `${resolve('/panel/perfil')}?aviso=password_changed`;
		redirect(303, done);
	}
};
