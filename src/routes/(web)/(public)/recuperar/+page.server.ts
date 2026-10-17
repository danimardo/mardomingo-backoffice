// W12 · `/recuperar` (contracts/web-routes.md W12; BE-FR-05). La respuesta es siempre la misma: el email solo sale si
// la cuenta existe, y la página lo dice sin revelarlo.
import { RequestResetSchema } from '$lib/schemas/accounts/password-reset';
import { getComposition } from '$lib/server/composition.cache';
import { parseForm } from '$lib/server/forms';
import { AppError } from '$lib/server/shared/errors';
import { clientIpOf, failureOf } from '$lib/server/web/actions';
import type { Actions } from './$types';

export const actions: Actions = {
	solicitar: async ({ request, getClientAddress }) => {
		const parsed = parseForm(RequestResetSchema, await request.formData());
		if (!parsed.ok) return parsed.failure;

		try {
			await getComposition().accounts.requestPasswordReset({
				email: parsed.data.email,
				remoteIp: clientIpOf(getClientAddress)
			});
		} catch (error) {
			if (error instanceof AppError) return failureOf(error, { email: parsed.data.email });
			throw error;
		}
		return { success: true, messageKey: 'reset_requested' as const };
	}
};
