// W09 · `/verificar` (contracts/web-routes.md W09; BE-FR-02, 12, 64 CA2). El enlace del email abre esta página sin
// consumir nada: la verificación ocurre por POST desde su botón. Un token usado o caducado remite a W10.
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import * as z from 'zod';
import { getComposition } from '$lib/server/composition.cache';
import { parseForm } from '$lib/server/forms';
import { AppError } from '$lib/server/shared/errors';
import { failureOf } from '$lib/server/web/actions';
import type { Actions, PageServerLoad } from './$types';

const TokenForm = z.strictObject({ token: z.string().min(1).max(512) });

export const load: PageServerLoad = ({ url }) => {
	const token = url.searchParams.get('token') ?? '';
	return {
		token,
		tokenState: token === '' ? ('invalid' as const) : getComposition().accounts.tokenState(token)
	};
};

export const actions: Actions = {
	verificar: async ({ request }) => {
		const parsed = parseForm(TokenForm, await request.formData());
		if (!parsed.ok) return parsed.failure;

		try {
			await getComposition().accounts.verifyEmail(parsed.data.token);
		} catch (error) {
			if (error instanceof AppError) return failureOf(error);
			throw error;
		}
		const next = resolve('/panel/bienvenida');
		redirect(303, next);
	}
};
