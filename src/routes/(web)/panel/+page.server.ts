// `/panel` (contracts/web-routes.md W18; BE-FR-49.1, 49.7, 49.13). Resumen de la cuenta: saldo y su desglose, bolsas con su
// caducidad, estado de la bienvenida, aviso de saldo bajo, documentos legales pendientes y el correo de soporte. Requiere cuenta
// verificada: sin sesión, al inicio de sesión; sin verificar, a reenviar la verificación. No se guarda en caché.
// Los anuncios (BE-FR-85) y el equivalente en euros llegan con sus lecturas de otras funcionalidades (T260, T261).
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor, appsUsedBy, reportDenial } from '$lib/server/features/accounts';
import { announcementsForPanel, supportEmail } from '$lib/server/features/apps';
import { pendingAcceptancesOf } from '$lib/server/features/legal';
import { syncedAppIds } from '$lib/server/features/sync';
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
	const userId = access.user.id;
	const balance = composition.credits.getBalance(userId);
	const welcome = composition.credits.welcomeOf(userId);

	return {
		email: access.user.email,
		balance: {
			totalMicro: balance.totalMicro,
			reservedMicro: balance.reservedMicro,
			availableMicro: balance.availableMicro,
			freeMicro: balance.freeMicro,
			paidMicro: balance.paidMicro,
			debtMicro: balance.debtMicro,
			nextFreeExpiry: balance.nextFreeExpiry
		},
		buckets: composition.credits.buckets(userId).map((bucket) => ({
			kind: bucket.kind,
			source: bucket.source,
			remainingMicro: bucket.remainingMicro,
			expiresOn: bucket.expiresOn,
			simulated: bucket.simulated
		})),
		welcome: { status: welcome === null ? ('none' as const) : ('granted' as const) },
		lowBalance: composition.credits.lowBalance(userId),
		pendingAcceptances: pendingAcceptancesOf(
			composition.db,
			userId,
			toEpochMs(composition.clock.now())
		).map((item) => ({ document: item.document, version: item.version })),
		announcements: announcementsForPanel(
			composition.apps,
			[
				...new Set([...appsUsedBy(composition.db, userId), ...syncedAppIds(composition.db, userId)])
			],
			toEpochMs(composition.clock.now())
		).map((item) => ({
			id: item.id,
			level: item.level,
			message: item.message,
			link: item.link,
			appName: item.appName
		})),
		supportEmail: supportEmail(composition.apps)
	};
};
