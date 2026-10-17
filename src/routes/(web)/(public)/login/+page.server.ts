// W11 · `/login` (contracts/web-routes.md W11; BE-FR-03, 04, 67; UX-04). Con sesión, va a su destino. El destino y el
// aviso son de una lista cerrada: nada de texto libre en la URL. Los errores son los del catálogo, sin distinguir cuentas.
import { redirect } from '@sveltejs/kit';
import * as z from 'zod';
import { LoginSchema } from '$lib/schemas/accounts/login';
import { getComposition } from '$lib/server/composition.cache';
import { safeRedirect } from '$lib/server/features/accounts';
import { parseForm } from '$lib/server/forms';
import { AppError } from '$lib/server/shared/errors';
import { clientIpOf, failureOf } from '$lib/server/web/actions';
import type { Actions, PageServerLoad } from './$types';

const NOTICES = Object.freeze([
	'password_reset',
	'email_changed',
	'session_expired',
	'logged_out'
] as const);
const NoticeSchema = z.enum(NOTICES).nullable().catch(null);

export const load: PageServerLoad = ({ locals, url }) => {
	const redirectTo = safeRedirect(url.searchParams.get('redirectTo'));
	if (locals.user !== null) redirect(303, redirectTo);
	return {
		redirectTo,
		notice: NoticeSchema.parse(url.searchParams.get('aviso'))
	};
};

export const actions: Actions = {
	entrar: async ({ request, getClientAddress }) => {
		const parsed = parseForm(LoginSchema, await request.formData());
		if (!parsed.ok) return parsed.failure;

		let destination: string;
		try {
			const result = await getComposition().accounts.login({
				email: parsed.data.email,
				password: parsed.data.password,
				redirectTo: parsed.data.redirectTo,
				remoteIp: clientIpOf(getClientAddress)
			});
			destination = result.redirectTo;
		} catch (error) {
			if (error instanceof AppError) return failureOf(error, { email: parsed.data.email });
			throw error;
		}
		redirect(303, destination);
	}
};
