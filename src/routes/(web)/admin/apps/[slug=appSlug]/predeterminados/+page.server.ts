// W42 · `/admin/apps/[slug]/predeterminados` (contracts/web-routes.md W42; BE-FR-42; T312). Predeterminados de una app: el documento
// que reciben las cuentas nuevas. Se valida con el esquema de sincronización de la app y no modifica ninguna cuenta. Requiere rol de
// administrador. La edición es en JSON, validada por el mismo esquema que usa la sincronización.
import { error, fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor } from '$lib/server/features/accounts';
import { findActiveAppBySlug } from '$lib/server/features/apps';
import { getDefaults, updateDefaults } from '$lib/server/features/sync';
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

export const load: PageServerLoad = ({ locals, params, setHeaders }) => {
	adminOrThrow(locals);
	setHeaders({ 'cache-control': 'private, no-store' });
	const composition = getComposition();
	const app = findActiveAppBySlug(composition.apps, params.slug);
	if (app === undefined) error(404);
	return {
		app: { id: app.id, name: app.name, slug: params.slug },
		defaultsJson: JSON.stringify(getDefaults(composition.sync, app.id), null, 2)
	};
};

export const actions: Actions = {
	guardarPredeterminados: async ({ locals, params, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		if (!isConfirmed(form)) return fail(400, { formError: 'VALIDATION_ERROR' });
		const composition = getComposition();
		const app = findActiveAppBySlug(composition.apps, params.slug);
		if (app === undefined) error(404);
		let data: unknown;
		try {
			data = JSON.parse(textOf(form, 'datos'));
		} catch {
			return fail(400, { errors: { datos: 'validation_invalid' } });
		}
		try {
			updateDefaults(composition.sync, { adminId: admin.id, appId: app.id, data });
		} catch (cause) {
			if (cause instanceof AppError) return failureOf(cause);
			throw cause;
		}
		const back = `/admin/apps/${encodeURIComponent(params.slug)}/predeterminados`;
		redirect(303, back);
	}
};
