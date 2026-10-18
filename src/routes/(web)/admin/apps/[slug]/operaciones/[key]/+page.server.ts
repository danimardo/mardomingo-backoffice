// W41 · `/admin/apps/[slug]/operaciones/[key]` (contracts/web-routes.md W41; BE-FR-77, BE-FR-78; T311). Ficha de una operación de IA y
// su activación. La comprobación del modelo la hace `ai` contra el catálogo guardado; `apps` solo aplica el resultado y audita. Requiere
// rol de administrador y confirmación.
import { error, fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor } from '$lib/server/features/accounts';
import {
	activateOperation,
	createTemplateVersion,
	deactivateOperation,
	findActiveAppBySlug,
	updateOperationSettings,
	operationForAdmin
} from '$lib/server/features/apps';
import { checkOperationActivatable } from '$lib/server/features/ai';
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
	const operation = operationForAdmin({ db: composition.db }, app.id, params.key);
	if (operation === null) error(404);
	const check = checkOperationActivatable(
		{ db: composition.db },
		{
			kind: operation.kind,
			model: operation.model,
			capabilities: operation.capabilities,
			estimatedMaxCostMicroUsd: operation.estimatedMaxCostMicroUsd
		}
	);
	return {
		app: { name: app.name, slug: params.slug },
		operation: {
			key: operation.key,
			kind: operation.kind,
			mode: operation.mode,
			model: operation.model,
			active: operation.active,
			timeoutMs: operation.timeoutMs,
			maxOutputTokens: operation.maxOutputTokens,
			temperatureMilli: operation.temperatureMilli,
			maxCostMicro: operation.maxCostMicro
		},
		activatable: check.ok,
		rejection: check.ok ? null : check.reason
	};
};

export const actions: Actions = {
	activar: async ({ locals, params, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		if (!isConfirmed(form)) return fail(400, { formError: 'VALIDATION_ERROR' });
		const composition = getComposition();
		const app = findActiveAppBySlug(composition.apps, params.slug);
		if (app === undefined) error(404);
		const operation = operationForAdmin({ db: composition.db }, app.id, params.key);
		if (operation === null) error(404);
		const check = checkOperationActivatable(
			{ db: composition.db },
			{
				kind: operation.kind,
				model: operation.model,
				capabilities: operation.capabilities,
				estimatedMaxCostMicroUsd: operation.estimatedMaxCostMicroUsd
			}
		);
		try {
			activateOperation(composition.apps, {
				actorId: admin.id,
				operationId: operation.id,
				check,
				reason: textOf(form, 'motivo')
			});
		} catch (cause) {
			if (cause instanceof AppError) return failureOf(cause);
			throw cause;
		}
		redirect(303, resolve(`/admin/apps/${params.slug}/operaciones/${params.key}`));
	},
	desactivar: async ({ locals, params, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		if (!isConfirmed(form)) return fail(400, { formError: 'VALIDATION_ERROR' });
		const composition = getComposition();
		const app = findActiveAppBySlug(composition.apps, params.slug);
		if (app === undefined) error(404);
		const operation = operationForAdmin({ db: composition.db }, app.id, params.key);
		if (operation === null) error(404);
		try {
			deactivateOperation(composition.apps, {
				actorId: admin.id,
				operationId: operation.id,
				reason: textOf(form, 'motivo')
			});
		} catch (cause) {
			if (cause instanceof AppError) return failureOf(cause);
			throw cause;
		}
		redirect(303, resolve(`/admin/apps/${params.slug}/operaciones/${params.key}`));
	},
	guardarPlantilla: async ({ locals, params, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		if (!isConfirmed(form)) return fail(400, { formError: 'VALIDATION_ERROR' });
		const composition = getComposition();
		const app = findActiveAppBySlug(composition.apps, params.slug);
		if (app === undefined) error(404);
		const operation = operationForAdmin({ db: composition.db }, app.id, params.key);
		if (operation === null) error(404);
		let body: unknown;
		try {
			body = JSON.parse(textOf(form, 'plantilla'));
		} catch {
			return fail(400, { errors: { plantilla: 'validation_invalid' } });
		}
		try {
			createTemplateVersion(composition.apps, {
				actorId: admin.id,
				operationId: operation.id,
				body
			});
		} catch (cause) {
			if (cause instanceof AppError) return failureOf(cause);
			throw cause;
		}
		redirect(303, resolve(`/admin/apps/${params.slug}/operaciones/${params.key}`));
	},
	guardarOperacion: async ({ locals, params, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		if (!isConfirmed(form)) return fail(400, { formError: 'VALIDATION_ERROR' });
		const composition = getComposition();
		const app = findActiveAppBySlug(composition.apps, params.slug);
		if (app === undefined) error(404);
		const operation = operationForAdmin({ db: composition.db }, app.id, params.key);
		if (operation === null) error(404);
		const tokens = textOf(form, 'tokensSalida');
		try {
			updateOperationSettings(composition.apps, {
				actorId: admin.id,
				operationId: operation.id,
				settings: {
					timeoutMs: Number(textOf(form, 'tiempoMs')),
					maxOutputTokens: tokens === '' ? null : Number(tokens),
					temperatureMilli: Number(textOf(form, 'temperaturaMilli')),
					maxCostMicro: Number(textOf(form, 'costeMaximoMicro'))
				},
				reason: textOf(form, 'motivo')
			});
		} catch (cause) {
			if (cause instanceof AppError) return failureOf(cause);
			throw cause;
		}
		redirect(303, resolve(`/admin/apps/${params.slug}/operaciones/${params.key}`));
	}
};
