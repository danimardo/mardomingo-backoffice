// Lógica de la acción `?/comprar` de W20 (contracts/web-routes.md W20; BE-FR-25 CA4, BE-FR-26, BE-FR-74). Está fuera de la
// acción de SvelteKit para probarla con entradas simples: la acción solo traduce el resultado a `redirect` o a `fail`.
import type { ActionFailure } from '@sveltejs/kit';
import type { Composition } from '$lib/server/composition';
import type { SessionUser } from '$lib/server/features/accounts';
import { recordWithdrawalWaiver } from '$lib/server/features/legal';
import { parseForm, type FormFailure } from '$lib/server/forms';
import { PurchaseForm, billingOf } from '$lib/schemas/payments/purchase';
import { AppError } from '$lib/server/shared/errors';
import { toEpochMs } from '$lib/shared/time';
import { failureOf } from './actions';

const BOOLEANS = Object.freeze(['waiverAccepted', 'wantsFullInvoice']);

export type PurchaseSubmit =
	| { readonly kind: 'redirect'; readonly location: string }
	| {
			readonly kind: 'failure';
			readonly failure: ActionFailure<FormFailure> | ReturnType<typeof failureOf>;
	  };

/** Registra la renuncia, guarda el perfil si hace falta y compra. Devuelve a dónde ir o el fallo de formulario. */
export function submitPurchase(
	composition: Composition,
	user: SessionUser,
	form: FormData,
	panelPath: string
): PurchaseSubmit {
	const parsed = parseForm(PurchaseForm, form, { booleans: BOOLEANS });
	if (!parsed.ok) return { kind: 'failure', failure: parsed.failure };
	const { data } = parsed;

	try {
		const waiverId = recordWithdrawalWaiver(composition.legal, {
			userId: user.id,
			appId: null,
			ip: null,
			now: toEpochMs(composition.clock.now()),
			version: data.waiverVersion
		});
		if (data.wantsFullInvoice) {
			const saved = composition.invoicing.saveBillingProfile({
				userId: user.id,
				profile: billingOf(data)
			});
			if (saved.status === 'rejected') {
				return {
					kind: 'failure',
					failure: failureOf(new AppError('VALIDATION_ERROR'), { packId: data.packId })
				};
			}
		}
		const outcome = composition.payments.purchase({
			userId: user.id,
			role: user.role,
			attemptId: data.intentId,
			packId: data.packId,
			wantsFullInvoice: data.wantsFullInvoice,
			withdrawalAcceptanceId: waiverId
		});
		const path = `${panelPath}/${outcome.paymentId}`;
		return {
			kind: 'redirect',
			location: outcome.status === 'repeated' ? `${path}?estado=repetida` : path
		};
	} catch (caught) {
		if (caught instanceof AppError) {
			return { kind: 'failure', failure: failureOf(caught, { packId: data.packId }) };
		}
		throw caught;
	}
}
