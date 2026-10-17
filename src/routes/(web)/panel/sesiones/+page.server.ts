// W26 · `/panel/sesiones` (contracts/web-routes.md W26; BE-FR-49.2; T264). Lista de sesiones vigentes de la cuenta con su IP
// aproximada y nunca el token. Cada sesión ajena se puede cerrar por separado; la sesión que se está usando no se cierra desde
// aquí. Requiere cuenta verificada.
import { fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import {
	accessFor,
	closeOtherSession,
	reportDenial,
	sessionsOf
} from '$lib/server/features/accounts';
import { civilDateOf } from '$lib/shared/dates';
import { toEpochMs } from '$lib/shared/time';
import type { Actions, PageServerLoad } from './$types';

/** Id de la sesión que hace la petición, o `null` si no se puede leer. */
async function currentSessionIdOf(headers: Headers): Promise<string | null> {
	const current = await getComposition().accounts.readSession(headers);
	return current?.session.id ?? null;
}

export const load: PageServerLoad = async ({ locals, setHeaders, url, request }) => {
	const access = accessFor(locals.user, 'verified');
	reportDenial(locals.log, access);
	if (access.kind === 'anonymous' || access.kind === 'blocked') {
		const login = `${resolve('/login')}?redirectTo=${encodeURIComponent(url.pathname)}`;
		redirect(303, login);
	}
	if (access.kind === 'unverified') {
		const resend = resolve('/verificar/reenviar');
		redirect(303, resend);
	}
	setHeaders({ 'cache-control': 'private, no-store' });
	if (access.kind !== 'allow') {
		const login = resolve('/login');
		redirect(303, login);
	}

	const composition = getComposition();
	const currentId = await currentSessionIdOf(request.headers);
	const sessions = sessionsOf(composition.db, access.user.id, toEpochMs(composition.clock.now()));
	return {
		closed: url.searchParams.get('aviso') === 'session_closed',
		sessions: sessions.map((item) => ({
			id: item.id,
			current: item.id === currentId,
			createdOn: civilDateOf(item.createdAt),
			lastUsedOn: item.lastUsedAt === null ? null : civilDateOf(toEpochMs(item.lastUsedAt)),
			deviceName: item.deviceName ?? '',
			approxIp: item.approxIp ?? ''
		}))
	};
};

export const actions: Actions = {
	cerrar: async ({ request, locals }) => {
		const access = accessFor(locals.user, 'verified');
		if (access.kind !== 'allow') {
			const login = resolve('/login');
			redirect(303, login);
		}
		const form = await request.formData();
		const sessionId = form.get('sessionId');
		if (typeof sessionId !== 'string' || sessionId === '') {
			return fail(400, { errors: { sessionId: 'validation_invalid' } });
		}
		const outcome = closeOtherSession(getComposition().db, {
			userId: access.user.id,
			sessionId,
			currentSessionId: await currentSessionIdOf(request.headers)
		});
		if (outcome !== 'closed') return fail(400, { errors: { sessionId: 'validation_invalid' } });
		const done = `${resolve('/panel/sesiones')}?aviso=session_closed`;
		redirect(303, done);
	}
};
