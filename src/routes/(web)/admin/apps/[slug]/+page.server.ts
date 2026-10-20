// W40 · `/admin/apps/[slug]` (contracts/web-routes.md W40; BE-FR-61 CA3; T310). Ficha de una app y sus sobrescrituras de límites. Cada
// valor debe ser igual o menor que su global, lo valida `updateAppOverrides`, y la auditoría va en la misma transacción. Exige
// motivo y confirmación. Requiere rol de administrador. Pendiente: enlaces, orígenes, mantenimiento, versiones y operaciones.
import { error, fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor } from '$lib/server/features/accounts';
import { appForAdmin, setAppMaintenance, updateAppOverrides } from '$lib/server/features/apps';
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
	const app = appForAdmin(getComposition().apps, params.slug);
	if (app === null) error(404);
	return { app };
};

/** Mantenimiento de la app como valor de formulario: `active` llega como texto y el mensaje se recorta en el servicio. */
function maintenanceOf(form: FormData) {
	return { active: textOf(form, 'activo') === 'true', message: textOf(form, 'mensaje') };
}

export const actions: Actions = {
	previsualizarMantenimiento: async ({ locals, params, request }) => {
		adminOrThrow(locals);
		const form = await request.formData();
		const app = appForAdmin(getComposition().apps, params.slug);
		if (app === null) error(404);
		const next = maintenanceOf(form);
		return {
			maintenancePreview: {
				before: { active: app.maintenanceActive, message: app.maintenanceMessage },
				after: next
			}
		};
	},
	guardarMantenimiento: async ({ locals, params, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		if (!isConfirmed(form)) return fail(400, { formError: 'VALIDATION_ERROR' });
		const composition = getComposition();
		const app = appForAdmin(composition.apps, params.slug);
		if (app === null) error(404);
		const next = maintenanceOf(form);
		try {
			setAppMaintenance(composition.apps, {
				actorId: admin.id,
				appId: app.id,
				active: next.active,
				message: next.message,
				reason: textOf(form, 'motivo')
			});
		} catch (cause) {
			if (cause instanceof AppError) return failureOf(cause);
			throw cause;
		}
		redirect(303, `/admin/apps/${encodeURIComponent(params.slug)}`);
	},
	guardarSobrescrituras: async ({ locals, params, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		if (!isConfirmed(form)) return fail(400, { formError: 'VALIDATION_ERROR' });
		const composition = getComposition();
		const app = appForAdmin(composition.apps, params.slug);
		if (app === null) error(404);
		let overrides: unknown;
		try {
			overrides = JSON.parse(textOf(form, 'sobrescrituras'));
		} catch {
			return fail(400, { errors: { sobrescrituras: 'validation_invalid' } });
		}
		try {
			updateAppOverrides(composition.apps, {
				actorId: admin.id,
				appId: app.id,
				overrides,
				reason: textOf(form, 'motivo')
			});
		} catch (cause) {
			if (cause instanceof AppError) return failureOf(cause);
			throw cause;
		}
		const back = `/admin/apps/${encodeURIComponent(params.slug)}`;
		redirect(303, back);
	}
};
