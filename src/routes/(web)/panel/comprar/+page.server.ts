// W20 · `/panel/comprar` (contracts/web-routes.md W20; BE-FR-23–26, 49.2, 74). Sin `?paquete=`, la lista de paquetes sin
// ninguno preseleccionado; con él, el paso de confirmación con su `intentId`, la renuncia vigente y los datos fiscales. La
// acción registra la renuncia, guarda el perfil si se pide factura completa y compra. Una repetición del mismo intento
// lleva a la compra existente sin acreditar otra vez.
import { randomUUID } from 'node:crypto';
import { fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getComposition } from '$lib/server/composition.cache';
import { accessFor, reportDenial } from '$lib/server/features/accounts';
import { billingProfileOf } from '$lib/server/features/invoicing';
import type { PurchaseOutcome } from '$lib/server/features/payments';
import { currentVersions, recordWithdrawalWaiver } from '$lib/server/features/legal';
import { parseForm } from '$lib/server/forms';
import { AppError } from '$lib/server/shared/errors';
import { failureOf } from '$lib/server/web/actions';
import { PurchaseForm, billingOf } from '$lib/schemas/payments/purchase';
import { toEpochMs } from '$lib/shared/time';
import type { Actions, PageServerLoad } from './$types';

const BOOLEANS = Object.freeze(['waiverAccepted', 'wantsFullInvoice']);

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

		const parsed = parseForm(PurchaseForm, await request.formData(), { booleans: BOOLEANS });
		if (!parsed.ok) return parsed.failure;
		const { data } = parsed;
		const composition = getComposition();
		const userId = access.user.id;

		let outcome: PurchaseOutcome;
		try {
			const waiverId = recordWithdrawalWaiver(composition.legal, {
				userId,
				appId: null,
				ip: null,
				now: toEpochMs(composition.clock.now()),
				version: data.waiverVersion
			});
			if (data.wantsFullInvoice) {
				const saved = composition.invoicing.saveBillingProfile({
					userId,
					profile: billingOf(data)
				});
				if (saved.status === 'rejected') {
					return fail(400, { values: { packId: data.packId }, errors: { taxId: saved.reason } });
				}
			}
			outcome = composition.payments.purchase({
				userId,
				role: access.user.role,
				attemptId: data.intentId,
				packId: data.packId,
				wantsFullInvoice: data.wantsFullInvoice,
				withdrawalAcceptanceId: waiverId
			});
		} catch (caught) {
			if (caught instanceof AppError) return failureOf(caught, { packId: data.packId });
			throw caught;
		}

		const path = `${resolve('/panel/comprar')}/${outcome.paymentId}`;
		const target = outcome.status === 'repeated' ? `${path}?estado=repetida` : path;
		redirect(303, target);
	}
};
