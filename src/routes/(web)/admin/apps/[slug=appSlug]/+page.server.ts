// W40 · `/admin/apps/[slug]` (contracts/web-routes.md W40; BE-FR-61 CA3; T310). Ficha de una app y sus sobrescrituras de límites. Cada
// valor debe ser igual o menor que su global, lo valida `updateAppOverrides`, y la auditoría va en la misma transacción. Exige
// motivo y confirmación. Requiere rol de administrador. Pendiente: enlaces, orígenes, mantenimiento, versiones y operaciones.
import { error, fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor } from '$lib/server/features/accounts';
import {
	appDetailsForAdmin,
	appForAdmin,
	createOperation,
	setAppMaintenance,
	updateAppDetails,
	updateAppVersions,
	updateAppOverrides
} from '$lib/server/features/apps';
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
	const app = appForAdmin(composition.apps, params.slug);
	if (app === null) error(404);
	const details = appDetailsForAdmin({ db: composition.db }, params.slug);
	if (details === null) error(404);
	return {
		app,
		details: {
			name: details.name,
			description: details.description,
			supportEmail: details.supportEmail ?? '',
			postVerifyText: details.postVerifyText ?? '',
			links: JSON.stringify(details.links, null, 2),
			allowedOrigins: JSON.stringify(details.allowedOrigins, null, 2),
			syncSchema: JSON.stringify(details.syncSchema, null, 2)
		},
		versions: {
			minAppVersion: details.minAppVersion ?? '',
			recommendedAppVersion: details.recommendedAppVersion ?? '',
			enforceVersion: details.enforceVersion
		}
	};
};

/** Mantenimiento de la app como valor de formulario: `active` llega como texto y el mensaje se recorta en el servicio. */
function maintenanceOf(form: FormData) {
	return { active: textOf(form, 'activo') === 'true', message: textOf(form, 'mensaje') };
}

/** Un campo JSON del formulario; si no es JSON válido se devuelve el texto y el servicio lo rechaza con su validación. */
function jsonField(form: FormData, key: string): unknown {
	const text = textOf(form, key);
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

const KINDS = Object.freeze(['chat', 'transcription', 'image'] as const);

/** Tipo de operación del formulario; uno que no existe se rechaza antes de llegar al servicio. */
function kindOf(value: string): (typeof KINDS)[number] | null {
	return KINDS.find((kind) => kind === value) ?? null;
}

export const actions: Actions = {
	guardarVersiones: async ({ locals, params, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		if (!isConfirmed(form)) return fail(400, { formError: 'VALIDATION_ERROR' });
		const composition = getComposition();
		const app = appForAdmin(composition.apps, params.slug);
		if (app === null) error(404);
		try {
			updateAppVersions(composition.apps, {
				actorId: admin.id,
				appId: app.id,
				minAppVersion: textOf(form, 'versionMinima'),
				recommendedAppVersion: textOf(form, 'versionRecomendada'),
				enforceVersion: textOf(form, 'exigirVersion') === 'true',
				reason: textOf(form, 'motivo')
			});
		} catch (cause) {
			if (cause instanceof AppError) return failureOf(cause);
			throw cause;
		}
		redirect(303, `/admin/apps/${encodeURIComponent(params.slug)}`);
	},
	crearOperacion: async ({ locals, params, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		if (!isConfirmed(form)) return fail(400, { formError: 'VALIDATION_ERROR' });
		const composition = getComposition();
		const app = appForAdmin(composition.apps, params.slug);
		if (app === null) error(404);
		const kind = kindOf(textOf(form, 'tipo'));
		if (kind === null) return fail(400, { errors: { tipo: 'validation_invalid' } });
		const model = textOf(form, 'modelo');
		const group = textOf(form, 'grupo');
		try {
			createOperation(composition.apps, admin.id, app.id, {
				key: textOf(form, 'clave'),
				name: textOf(form, 'nombre'),
				kind,
				model: model === '' ? null : model,
				groupLabel: group === '' ? null : group,
				timeoutMs: Number(textOf(form, 'tiempoMs')),
				maxCostMicro: Number(textOf(form, 'costeMaximoMicro')),
				capabilities: jsonField(form, 'capacidades'),
				active: false
			});
		} catch (cause) {
			if (cause instanceof AppError) return failureOf(cause);
			throw cause;
		}
		redirect(303, `/admin/apps/${encodeURIComponent(params.slug)}`);
	},
	guardarApp: async ({ locals, params, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		if (!isConfirmed(form)) return fail(400, { formError: 'VALIDATION_ERROR' });
		const composition = getComposition();
		const app = appForAdmin(composition.apps, params.slug);
		if (app === null) error(404);
		const support = textOf(form, 'soporte');
		const postVerify = textOf(form, 'textoPostVerificacion');
		try {
			updateAppDetails(composition.apps, {
				actorId: admin.id,
				appId: app.id,
				name: textOf(form, 'nombre'),
				description: textOf(form, 'descripcion'),
				supportEmail: support === '' ? null : support,
				postVerifyText: postVerify === '' ? null : postVerify,
				links: jsonField(form, 'enlaces'),
				allowedOrigins: jsonField(form, 'origenes'),
				syncSchema: jsonField(form, 'esquemaSincronizacion'),
				reason: textOf(form, 'motivo')
			});
		} catch (cause) {
			if (cause instanceof AppError) return failureOf(cause);
			throw cause;
		}
		redirect(303, `/admin/apps/${encodeURIComponent(params.slug)}`);
	},
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
