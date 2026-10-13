// W27 · `/panel/perfil` (contracts/web-routes.md W27; T266, BE-FR-06). Muestra el email de la cuenta y permite cambiar la contraseña
// con la actual. Cambiar el email queda fuera de esta versión: exige su propio flujo de confirmación (pendiente de decisión).
// Requiere cuenta verificada. La acción revoca las demás sesiones (Better Auth) y avisa en la misma página.
import { fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor, reportDenial } from '$lib/server/features/accounts';
import { parseForm } from '$lib/server/forms';
import { ChangePasswordSchema } from '$lib/schemas/accounts/change-password';
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
	return {
		email: access.user.email,
		passwordChanged: url.searchParams.get('aviso') === 'password_changed'
	};
};

export const actions: Actions = {
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
