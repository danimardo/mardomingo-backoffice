// W43 · `/admin/apps/[slug]/predeterminados/copiar` (contracts/web-routes.md W43; BE-FR-42 CA3–CA4; T312). Copia elementos de la cuenta
// `usuario` (parámetro GET) a los predeterminados de la app. La vista previa lista las categorías y sus elementos sin preselección;
// `copiar` solo sustituye las categorías con algún elemento marcado y exige al menos uno (400 NOTHING_SELECTED). Requiere
// rol de administrador. Deja auditoría por cada copia.
import { error, fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor } from '$lib/server/features/accounts';
import { findActiveAppBySlug } from '$lib/server/features/apps';
import { applyCopyAsDefaults, previewCopyAsDefaults } from '$lib/server/features/sync';
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

export const load: PageServerLoad = ({ locals, params, url, setHeaders }) => {
	adminOrThrow(locals);
	setHeaders({ 'cache-control': 'private, no-store' });
	const composition = getComposition();
	const app = findActiveAppBySlug(composition.apps, params.slug);
	if (app === undefined) error(404);
	const userId = url.searchParams.get('usuario') ?? '';
	const categories =
		userId === '' ? [] : previewCopyAsDefaults(composition.sync, { userId, appId: app.id });
	return { app: { id: app.id, name: app.name, slug: params.slug }, userId, categories };
};

export const actions: Actions = {
	copiar: async ({ locals, params, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		if (!isConfirmed(form)) return fail(400, { formError: 'VALIDATION_ERROR' });
		const composition = getComposition();
		const app = findActiveAppBySlug(composition.apps, params.slug);
		if (app === undefined) error(404);
		const userField = form.get('usuario');
		const userId = typeof userField === 'string' ? userField : '';
		if (userId === '') error(400);
		// Cada categoría llega como `sel:<categoría>` con sus elementos marcados; sin marcar, no llega nada.
		const selection = [...new Set(form.keys())]
			.filter((key) => key.startsWith('sel:'))
			.map((key) => ({
				category: key.slice('sel:'.length),
				elements: form
					.getAll(key)
					.filter((value): value is string => typeof value === 'string' && value !== '')
			}))
			.filter((item) => item.elements.length > 0);
		if (selection.length === 0) return fail(400, { formError: 'NOTHING_SELECTED' });
		try {
			applyCopyAsDefaults(composition.sync, {
				adminId: admin.id,
				userId,
				appId: app.id,
				selection
			});
		} catch (cause) {
			if (cause instanceof AppError) return failureOf(cause);
			throw cause;
		}
		const back = `/admin/apps/${encodeURIComponent(params.slug)}/predeterminados`;
		redirect(303, back);
	}
};
