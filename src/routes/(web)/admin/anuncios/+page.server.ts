// W49 · `/admin/anuncios` (contracts/web-routes.md W49; BE-FR-85; T315). Lista de anuncios, creación y desactivación. Cada cambio
// queda en la auditoría. Las fechas se leen en UTC (`AAAA-MM-DDTHH:MM`). Requiere rol de administrador.
import { error, fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor } from '$lib/server/features/accounts';
import {
	createAnnouncement,
	updateAnnouncement,
	validatedAnnouncement,
	deactivateAnnouncement,
	listAnnouncements,
	appOptionsForAnnouncements,
	type AnnouncementInput
} from '$lib/server/features/apps';
import { AppError } from '$lib/server/shared/errors';
import { failureOf } from '$lib/server/web/actions';
import { toEpochMs } from '$lib/shared/time';
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

/** Instante de un campo `AAAA-MM-DDTHH:MM` (UTC). Nulo si está vacío o no es una fecha. */
function instantOf(value: string): number | null {
	if (value === '') return null;
	const ms = Date.parse(`${value}:00Z`);
	return Number.isNaN(ms) ? Number.NaN : ms;
}

export const load: PageServerLoad = ({ locals, setHeaders }) => {
	adminOrThrow(locals);
	setHeaders({ 'cache-control': 'private, no-store' });
	const composition = getComposition();
	return {
		apps: appOptionsForAnnouncements(composition.adminAnnouncements),
		announcements: listAnnouncements(composition.adminAnnouncements).map((row) => ({
			id: row.id,
			appId: row.appId,
			level: row.level,
			message: row.message,
			startsAt: new Date(row.startsAt).toISOString(),
			endsAt: row.endsAt === null ? null : new Date(row.endsAt).toISOString(),
			active: row.active
		}))
	};
};

/** Lee el anuncio del formulario (crear, previsualizar y guardar comparten campos). Devuelve `null` si una fecha no es válida. */
function announcementOf(form: FormData): AnnouncementInput | null {
	const startsAt = instantOf(textOf(form, 'inicio'));
	const endsRaw = instantOf(textOf(form, 'fin'));
	if (startsAt === null || Number.isNaN(startsAt) || Number.isNaN(endsRaw)) return null;
	const appValue = textOf(form, 'appId');
	return {
		appId: appValue === '' ? null : appValue,
		level: textOf(form, 'nivel'),
		message: textOf(form, 'mensaje'),
		link: textOf(form, 'enlace') || null,
		startsAt: toEpochMs(startsAt),
		endsAt: endsRaw === null ? null : toEpochMs(endsRaw),
		minVersion: textOf(form, 'minVersion') || null,
		maxVersion: textOf(form, 'maxVersion') || null
	};
}

export const actions: Actions = {
	previsualizar: async ({ locals, request }) => {
		adminOrThrow(locals);
		const form = await request.formData();
		const input = announcementOf(form);
		if (input === null) return fail(400, { errors: { inicio: 'validation_invalid' } });
		try {
			return { preview: validatedAnnouncement(input) };
		} catch (cause) {
			if (cause instanceof AppError) return failureOf(cause);
			throw cause;
		}
	},
	guardar: async ({ locals, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		const input = announcementOf(form);
		if (input === null) return fail(400, { errors: { inicio: 'validation_invalid' } });
		try {
			updateAnnouncement(getComposition().adminAnnouncements, {
				adminId: admin.id,
				id: textOf(form, 'anuncioId'),
				announcement: input
			});
		} catch (cause) {
			if (cause instanceof AppError) return failureOf(cause);
			throw cause;
		}
		const back = resolve('/admin/anuncios');
		redirect(303, back);
	},
	crear: async ({ locals, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		const input = announcementOf(form);
		if (input === null) return fail(400, { errors: { inicio: 'validation_invalid' } });
		try {
			createAnnouncement(getComposition().adminAnnouncements, {
				adminId: admin.id,
				announcement: input
			});
		} catch (cause) {
			if (cause instanceof AppError) return failureOf(cause);
			throw cause;
		}
		const done = `${resolve('/admin/anuncios')}?aviso=anuncio_creado`;
		redirect(303, done);
	},
	desactivar: async ({ locals, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		try {
			deactivateAnnouncement(getComposition().adminAnnouncements, {
				adminId: admin.id,
				id: textOf(form, 'anuncioId')
			});
		} catch (cause) {
			if (cause instanceof AppError) return failureOf(cause);
			throw cause;
		}
		const back = resolve('/admin/anuncios');
		redirect(303, back);
	}
};
