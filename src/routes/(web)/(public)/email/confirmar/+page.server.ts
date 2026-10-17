// W14 · `/email/confirmar` (T266; BE-FR-66/CA1–CA4). El enlace del email abre la página sin consumir nada: el cambio se aplica
// solo por POST desde su botón. El resultado se queda en la página y dice qué sesiones se cerraron.
import * as z from 'zod';
import { getComposition } from '$lib/server/composition.cache';
import { parseForm } from '$lib/server/forms';
import { AppError } from '$lib/server/shared/errors';
import { failureOf } from '$lib/server/web/actions';
import type { Actions, PageServerLoad } from './$types';

const ConfirmForm = z.strictObject({ token: z.string().min(1).max(512) });

export const load: PageServerLoad = ({ url }) => ({
	token: url.searchParams.get('token') ?? ''
});

export const actions: Actions = {
	confirmar: async ({ request }) => {
		const parsed = parseForm(ConfirmForm, await request.formData());
		if (!parsed.ok) return parsed.failure;

		try {
			const result = await getComposition().accounts.confirmEmailChange(parsed.data.token);
			return { result };
		} catch (error) {
			if (error instanceof AppError) return failureOf(error);
			throw error;
		}
	}
};
