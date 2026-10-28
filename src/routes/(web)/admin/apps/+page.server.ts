// W39 · `/admin/apps` (contracts/web-routes.md W39; BE-FR-61, BE-FR-62; T310). Lista de apps y alta de una nueva. Los campos complejos
// (tipos de cliente, enlaces, esquema de sincronización y orígenes) se leen como JSON y los valida `createApp`, que audita. Un slug
// ya usado responde `409 SLUG_TAKEN`. Requiere rol de administrador.
import { error, fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor } from '$lib/server/features/accounts';
import { createApp, isValidSlug, listAppsForAdmin } from '$lib/server/features/apps';
import { isConfirmed } from '$lib/server/forms/confirmation';
import { AppError } from '$lib/server/shared/errors';
import { failureOf } from '$lib/server/web/actions';
import type { Actions, PageServerLoad } from './$types';

function adminOrThrow(locals: App.Locals) {
	const access = accessFor(locals.user, 'admin');
	if (access.kind === 'anonymous' || access.kind === 'blocked' || access.kind === 'unverified') {
		const login = resolve('/login');
		redirect(303, login);
	}
	if (access.kind !== 'allow') error(403);
	return access.user;
}

function textOf(form: FormData, key: string): string {
	const value = form.get(key);
	return typeof value === 'string' ? value : '';
}

/** JSON de un campo; si no es JSON válido, se devuelve el texto tal cual y el servicio lo rechaza con su validación. */
function jsonOf(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

export const load: PageServerLoad = ({ locals, setHeaders }) => {
	adminOrThrow(locals);
	setHeaders({ 'cache-control': 'private, no-store' });
	return { apps: listAppsForAdmin(getComposition().apps) };
};

export const actions: Actions = {
	crearApp: async ({ locals, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		if (!isConfirmed(form)) return fail(400, { formError: 'VALIDATION_ERROR' });
		const slug = textOf(form, 'slug').trim();
		const name = textOf(form, 'nombre').trim();
		if (slug === '' || name === '') return fail(400, { errors: { slug: 'validation_required' } });
		// Formato fijado al dar de alta (D10 = R15): 2 a 40 caracteres, letra minúscula inicial, después minúsculas, dígitos o guion.
		if (!isValidSlug(slug)) return fail(400, { errors: { slug: 'slug_format' } });
		try {
			createApp(getComposition().apps, admin.id, {
				slug,
				name,
				description: textOf(form, 'descripcion'),
				clientTypes: jsonOf(textOf(form, 'tiposCliente')),
				links: jsonOf(textOf(form, 'enlaces')),
				syncSchema: jsonOf(textOf(form, 'esquemaSincronizacion')),
				allowedOrigins: jsonOf(textOf(form, 'origenes')),
				supportEmail: textOf(form, 'soporte') || null
			});
		} catch (cause) {
			if (cause instanceof AppError) return failureOf(cause);
			throw cause;
		}
		const back = resolve('/admin/apps');
		redirect(303, back);
	}
};
