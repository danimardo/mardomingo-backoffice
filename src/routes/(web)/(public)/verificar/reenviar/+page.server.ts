// W10 · `/verificar/reenviar` (contracts/web-routes.md W10; BE-FR-02 CA3). Siempre responde lo mismo, exista o no el
// email: la respuesta no revela cuentas, y el límite por IP se cuenta en `accounts`.
import { ResendSchema } from '$lib/schemas/accounts/resend';
import { getComposition } from '$lib/server/composition.cache';
import { parseForm } from '$lib/server/forms';
import { AppError } from '$lib/server/shared/errors';
import { clientIpOf, failureOf } from '$lib/server/web/actions';
import type { Actions } from './$types';

export const actions: Actions = {
	reenviar: async ({ request, getClientAddress }) => {
		const parsed = parseForm(ResendSchema, await request.formData());
		if (!parsed.ok) return parsed.failure;

		try {
			await getComposition().accounts.resendVerification({
				email: parsed.data.email,
				remoteIp: clientIpOf(getClientAddress)
			});
		} catch (error) {
			if (error instanceof AppError) return failureOf(error, { email: parsed.data.email });
			throw error;
		}
		return { success: true, messageKey: 'verification_resent' as const };
	}
};
