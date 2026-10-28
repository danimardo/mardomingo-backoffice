// Reembolso manual de una compra (BE-FR-27; T229, D01, D02). Sin I/O: el estado, lo ya devuelto y el importe llegan por parámetro.
// El administrador indica los créditos no consumidos a retirar (D01); el saldo real de la bolsa lo comprueba `credits` al retirar.
// En compras reales se devuelve un importe (≤ lo pagado menos lo ya devuelto). En compras simuladas no hay importe (D02): solo
// se retiran créditos y la compra queda reembolsada sin importe, una sola vez.

export type RefundStatus =
	'pending' | 'completed' | 'refunded' | 'partially_refunded' | 'chargeback';

export interface RefundInput {
	readonly simulated: boolean;
	readonly status: RefundStatus;
	readonly paidEurCents: number;
	readonly alreadyRefundedEurCents: number;
	/** Céntimos a devolver. En compras simuladas debe ser 0. */
	readonly amountEurCents: number;
	/** Micro-créditos no consumidos a retirar de la bolsa de la compra. Cero no retira nada. */
	readonly creditsToRemoveMicro: number;
}

export type RefundRejection =
	| 'amount_not_positive'
	| 'amount_exceeds_paid'
	| 'amount_not_allowed'
	| 'credits_negative'
	| 'nothing_to_refund'
	| 'not_completed';

export type RefundPlan =
	| {
			readonly ok: true;
			readonly newRefundedEurCents: number;
			readonly newStatus: 'refunded' | 'partially_refunded';
	  }
	| { readonly ok: false; readonly reason: RefundRejection };

export function planRefund(input: RefundInput): RefundPlan {
	if (input.creditsToRemoveMicro < 0) return { ok: false, reason: 'credits_negative' };
	if (input.simulated) {
		if (input.amountEurCents !== 0) return { ok: false, reason: 'amount_not_allowed' };
		// Una compra simulada solo se reembolsa una vez: al reembolsarla pasa a `refunded` y deja de ser `completed`.
		if (input.status !== 'completed') return { ok: false, reason: 'not_completed' };
		if (input.creditsToRemoveMicro === 0) return { ok: false, reason: 'nothing_to_refund' };
		return { ok: true, newRefundedEurCents: 0, newStatus: 'refunded' };
	}
	if (input.amountEurCents <= 0) return { ok: false, reason: 'amount_not_positive' };
	const refundable = input.paidEurCents - input.alreadyRefundedEurCents;
	if (input.amountEurCents > refundable) return { ok: false, reason: 'amount_exceeds_paid' };
	const newRefundedEurCents = input.alreadyRefundedEurCents + input.amountEurCents;
	return {
		ok: true,
		newRefundedEurCents,
		newStatus: newRefundedEurCents === input.paidEurCents ? 'refunded' : 'partially_refunded'
	};
}
