// W20 · `/panel/comprar` (contracts/web-routes.md W20; BE-FR-23–26, 49.2, 74). Sin `?paquete=`, la lista de paquetes sin
// ninguno preseleccionado; con él, el paso de confirmación con su `intentId`, la renuncia vigente y los datos fiscales. La
// acción registra la renuncia, guarda el perfil si se pide factura completa y compra. Una repetición del mismo intento
// lleva a la compra existente sin acreditar otra vez.
import { randomUUID } from 'node:crypto';
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor, reportDenial } from '$lib/server/features/accounts';
import { billingProfileOf } from '$lib/server/features/invoicing';
import { currentVersions } from '$lib/server/features/legal';
import { toEpochMs } from '$lib/shared/time';
import { submitPurchase } from '$lib/server/web/purchase';
import type { Actions, PageServerLoad } from './$types';

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
	const packs = composition.payments.packsForSale();
	const selectedId = url.searchParams.get('paquete');
	const selected = packs.find((pack) => pack.id === selectedId) ?? null;
	const waiver = currentVersions(composition.legal, toEpochMs(composition.clock.now()), [
		'withdrawal_waiver'
	]).get('withdrawal_waiver');
	const profile = billingProfileOf(composition.db, access.user.id);

	return {
		packs,
		availability: composition.payments.availability(access.user.role),
		selected,
		intentId: selected === null ? null : randomUUID(),
		waiverText: { version: waiver?.version ?? null },
		billingProfile:
			profile === undefined
				? { complete: false as const }
				: {
						complete: true as const,
						values: {
							kind: profile.kind,
							legalName: profile.legalName,
							taxId: profile.taxId,
							address: profile.address,
							postalCode: profile.postalCode,
							city: profile.city,
							country: profile.country
						}
					}
	};
};

export const actions: Actions = {
	comprar: async ({ request, locals }) => {
		const access = accessFor(locals.user, 'verified');
		if (access.kind !== 'allow') {
			const login = resolve('/login');
			redirect(303, login);
		}
		const result = submitPurchase(
			getComposition(),
			access.user,
			await request.formData(),
			resolve('/panel/comprar')
		);
		if (result.kind === 'failure') return result.failure;
		redirect(303, result.location);
	}
};
