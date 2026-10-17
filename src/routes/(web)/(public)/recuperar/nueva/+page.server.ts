// W13 · `/recuperar/nueva` (contracts/web-routes.md W13; BE-FR-05, BE-FR-67 CA2). El token se consume al cambiar la
// contraseña: de un solo uso y con una hora de validez, que decide Better Auth.
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { ResetPasswordSchema } from '$lib/schemas/accounts/password-reset';
import { PASSWORD_MAX, PASSWORD_MIN } from '$lib/schemas/accounts/register';
import { getComposition } from '$lib/server/composition.cache';
import { parseForm } from '$lib/server/forms';
import { AppError } from '$lib/server/shared/errors';
import { failureOf } from '$lib/server/web/actions';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const token = url.searchParams.get('token') ?? '';
	return {
		token,
		tokenState:
			token === '' ? ('invalid' as const) : getComposition().accounts.tokenState(token, 'reset'),
		passwordRule: { min: PASSWORD_MIN, max: PASSWORD_MAX }
	};
};

export const actions: Actions = {
	restablecer: async ({ request }) => {
		const parsed = parseForm(ResetPasswordSchema, await request.formData());
		if (!parsed.ok) return parsed.failure;

		try {
			await getComposition().accounts.resetPassword({
				token: parsed.data.token,
				password: parsed.data.password
			});
		} catch (error) {
			if (error instanceof AppError) return failureOf(error);
			throw error;
		}
		const next = `${resolve('/login')}?aviso=password_reset`;
		redirect(303, next);
	}
};
