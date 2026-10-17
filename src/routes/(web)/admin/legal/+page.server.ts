// W48 · `/admin/legal` (contracts/web-routes.md W48; BE-FR-70, BE-FR-26; T314). Versiones vigentes de cada documento y publicación de una
// nueva versión. Una versión publicada no se edita. Una informativa avisa por correo a cada cuenta verificada; una que exige reaceptación
// bloquea hasta que cada persona la acepte. Requiere rol de administrador y confirmación.
import { error, fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor } from '$lib/server/features/accounts';
import { currentVersions, LEGAL_DOCUMENTS } from '$lib/server/features/legal';
import { isConfirmed } from '$lib/server/forms/confirmation';
import { AppError } from '$lib/server/shared/errors';
import { failureOf } from '$lib/server/web/actions';
import { publishAndNotify } from '$lib/server/web/legal-publish';
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

export const load: PageServerLoad = ({ locals, setHeaders }) => {
	adminOrThrow(locals);
	setHeaders({ 'cache-control': 'private, no-store' });
	const composition = getComposition();
	const now = toEpochMs(composition.clock.now());
	const current = currentVersions(composition.legalPublish, now, [...LEGAL_DOCUMENTS]);
	return {
		documents: [...LEGAL_DOCUMENTS].map((document) => ({
			document,
			version: current.get(document)?.version ?? null,
			requiresReacceptance: current.get(document)?.requiresReacceptance ?? false
		}))
	};
};

export const actions: Actions = {
	publicar: async ({ locals, request }) => {
		const admin = adminOrThrow(locals);
		const form = await request.formData();
		if (!isConfirmed(form)) return fail(400, { formError: 'VALIDATION_ERROR' });
		const document = LEGAL_DOCUMENTS.find((item) => item === textOf(form, 'documento'));
		if (document === undefined) return fail(400, { errors: { documento: 'validation_invalid' } });
		const requiresReacceptance = form.get('requiereReaceptacion') === 'true';
		try {
			await publishAndNotify(getComposition(), {
				adminId: admin.id,
				document,
				version: textOf(form, 'version'),
				content: textOf(form, 'contenido'),
				requiresReacceptance
			});
		} catch (cause) {
			if (cause instanceof AppError) return failureOf(cause);
			throw cause;
		}
		const back = resolve('/admin/legal');
		redirect(303, back);
	}
};
