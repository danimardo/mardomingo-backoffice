// W14 · `/email/confirmar` (T266, C-19; BE-FR-66/CA1–CA5). El enlace del email abre la página sin consumir nada: el cambio se aplica
// solo por POST desde su botón. Se conserva la sesión actual (las demás se revocan) y se redirige con 303 al perfil (con sesión
// de la cuenta) o al login (sin ella) con `?aviso=email_changed`. Un enlace inválido, caducado o ya usado responde 400 con su
// código `TOKEN_*`; una dirección que ya no está libre responde 400 `TOKEN_INVALID` y la página distingue el motivo.
import { fail, redirect } from '@sveltejs/kit';
import * as z from 'zod';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { parseForm } from '$lib/server/forms';
import type { ErrorCode } from '$lib/server/shared/errors';
import type { Actions, PageServerLoad } from './$types';

const ConfirmForm = z.strictObject({ token: z.string().min(1).max(512) });

const FAILURE_CODE = Object.freeze({
	expired: 'TOKEN_EXPIRED',
	invalid: 'TOKEN_INVALID',
	taken: 'TOKEN_INVALID'
} as const satisfies Record<'expired' | 'invalid' | 'taken', ErrorCode>);

export const load: PageServerLoad = ({ url }) => ({
	token: url.searchParams.get('token') ?? ''
});

export const actions: Actions = {
	confirmar: async ({ request, locals }) => {
		const parsed = parseForm(ConfirmForm, await request.formData());
		if (!parsed.ok) return parsed.failure;

		const result = await getComposition().accounts.confirmEmailChange(
			parsed.data.token,
			locals.session?.id ?? null
		);
		if (result.outcome !== 'applied') {
			return fail(400, { formError: FAILURE_CODE[result.outcome], outcome: result.outcome });
		}
		const target = result.sessionKept ? resolve('/panel/perfil') : resolve('/login');
		redirect(303, `${target}?aviso=email_changed`);
	}
};
