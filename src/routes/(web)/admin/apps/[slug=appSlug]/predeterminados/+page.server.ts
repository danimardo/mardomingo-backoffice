// W42 · `/admin/apps/[slug]/predeterminados` (contracts/web-routes.md W42; BE-FR-42; T312). Predeterminados de una app: el documento
// que reciben las cuentas nuevas. Se valida con el esquema de sincronización de la app y no modifica ninguna cuenta. Requiere rol de
// administrador. La edición es en JSON, validada por el mismo esquema que usa la sincronización. Exige motivo y confirmación
// (BE-FR-55; C-41): la auditoría guarda el motivo y un resumen sin contenido. Guardar o copiar vuelve con `?aviso=saved&auditoria=<id>`
// y la página enlaza con esa entrada (UX-13; C-54).
import { error, fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor } from '$lib/server/features/accounts';
import { findActiveAppBySlug } from '$lib/server/features/apps';
import { getDefaults, updateDefaults } from '$lib/server/features/sync';
import { isConfirmed, savedEntryOf, savedRedirect } from '$lib/server/forms/confirmation';
import { reasonRejection } from '$lib/server/forms/reason';
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

export const load: PageServerLoad = ({ locals, params, setHeaders, url }) => {
	adminOrThrow(locals);
	setHeaders({ 'cache-control': 'private, no-store' });
	const composition = getComposition();
	const app = findActiveAppBySlug(composition.apps, params.slug);
	if (app === undefined) error(404);
	return {
		saved: savedEntryOf(url),
		app: { id: app.id, name: app.name, slug: params.slug },
		defaultsJson: JSON.stringify(getDefaults(composition.sync, app.id), null, 2)
	};
};

export const actions: Actions = {
	guardarPredeterminados: async ({ locals, params, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		const written = textOf(form, 'datos');
		const reason = textOf(form, 'motivo');
		// Lo escrito vuelve a la página en cualquier fallo (`values`), para que no se pierda.
		const values = { datos: written, motivo: reason };
		if (!isConfirmed(form)) {
			return fail(400, { formError: 'VALIDATION_ERROR', values });
		}
		const composition = getComposition();
		const app = findActiveAppBySlug(composition.apps, params.slug);
		if (app === undefined) error(404);
		let data: unknown;
		try {
			data = JSON.parse(written);
		} catch {
			return fail(400, { errors: { datos: 'validation_invalid' }, values });
		}
		// Motivo de 1 a 500 caracteres (C-55), con lo escrito (JSON y motivo) de vuelta.
		const rejected = reasonRejection(reason, { values });
		if (rejected !== null) return rejected;
		let entryId: string;
		try {
			entryId = updateDefaults(composition.sync, {
				adminId: admin.id,
				appId: app.id,
				data,
				reason
			});
		} catch (cause) {
			if (cause instanceof AppError) {
				const field = cause.details.field;
				if (cause.code === 'VALIDATION_ERROR' && field === 'reason') {
					return fail(400, { errors: { motivo: 'validation_required' }, values });
				}
				if (cause.code === 'VALIDATION_ERROR') {
					return fail(400, {
						errors: { datos: 'validation_invalid' },
						values,
						// La categoría que no cumple el esquema (BE-FR-42): «data» es el documento entero, no una categoría.
						...(typeof field === 'string' && field !== 'data' ? { category: field } : {})
					});
				}
				return failureOf(cause, values);
			}
			throw cause;
		}
		const back = `/admin/apps/${encodeURIComponent(params.slug)}/predeterminados`;
		redirect(303, savedRedirect(back, entryId));
	}
};
