// W33 · `/admin` (contracts/web-routes.md W33; BE-FR-46, BE-FR-55; T304). Resumen para el administrador: alertas activas con su fecha,
// estado del freno de coste diario, cuentas registradas y entradas de auditoría de hoy. Solo lectura. Requiere rol de administrador.
import { error, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor, userCount } from '$lib/server/features/accounts';
import { activeAlerts } from '$lib/server/features/notifications';
import { brakeStatus } from '$lib/server/features/protections';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, setHeaders }) => {
	const access = accessFor(locals.user, 'admin');
	if (access.kind === 'anonymous' || access.kind === 'blocked' || access.kind === 'unverified') {
		const login = resolve('/login');
		redirect(303, login);
	}
	if (access.kind !== 'allow') error(403);
	setHeaders({ 'cache-control': 'private, no-store' });
	const composition = getComposition();
	return {
		alerts: activeAlerts(composition.db).map((alert) => ({
			key: alert.key,
			activatedAt: new Date(alert.updatedAt).toISOString(),
			lastSentAt: alert.lastSentAt === null ? null : new Date(alert.lastSentAt).toISOString()
		})),
		brake: brakeStatus(composition.brake),
		accounts: userCount(composition.adminUsers)
	};
};
