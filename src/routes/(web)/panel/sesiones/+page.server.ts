// W26 · `/panel/sesiones` (contracts/web-routes.md W26; BE-FR-49.2). Lista de sesiones vigentes de la cuenta con su IP aproximada,
// nunca la completa ni el token. Cerrar sesiones desde aquí queda pendiente (su acción va en T264). Requiere cuenta verificada.
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor, reportDenial, sessionsOf } from '$lib/server/features/accounts';
import { civilDateOf } from '$lib/shared/dates';
import { toEpochMs } from '$lib/shared/time';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, setHeaders, url }) => {
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
	const sessions = sessionsOf(composition.db, access.user.id, toEpochMs(composition.clock.now()));
	return {
		sessions: sessions.map((item) => ({
			createdOn: civilDateOf(item.createdAt),
			lastUsedOn: item.lastUsedAt === null ? null : civilDateOf(toEpochMs(item.lastUsedAt)),
			deviceName: item.deviceName ?? '',
			approxIp: item.approxIp ?? ''
		}))
	};
};
