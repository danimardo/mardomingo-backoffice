// Reembolso manual de una compra (BE-FR-27; T229). Sin I/O: el saldo de la bolsa y lo ya devuelto llegan por parámetro.
// Un reembolso no puede devolver más de lo pagado menos lo ya devuelto, ni retirar más créditos que el saldo no consumido
// de la bolsa de esa compra. El estado de la compra pasa a refunded si se devuelve todo, o a partially_refunded si no.

export interface RefundInput {
	readonly paidEurCents: number;
	readonly alreadyRefundedEurCents: number;
	readonly amountEurCents: number;
	readonly bucketRemainingMicro: number;
	readonly creditsToWithdrawMicro: number;
}

export type RefundPlan =
	| {
			readonly ok: true;
			readonly newRefundedEurCents: number;
			readonly newStatus: 'refunded' | 'partially_refunded';
	  }
	| {
			readonly ok: false;
			readonly reason: 'amount_not_positive' | 'amount_exceeds_paid' | 'credits_exceed_bucket';
	  };

export function planRefund(input: RefundInput): RefundPlan {
	if (input.amountEurCents <= 0) return { ok: false, reason: 'amount_not_positive' };
	const refundable = input.paidEurCents - input.alreadyRefundedEurCents;
	if (input.amountEurCents > refundable) return { ok: false, reason: 'amount_exceeds_paid' };
	if (input.creditsToWithdrawMicro > input.bucketRemainingMicro) {
		return { ok: false, reason: 'credits_exceed_bucket' };
	}
	const newRefundedEurCents = input.alreadyRefundedEurCents + input.amountEurCents;
	return {
		ok: true,
		newRefundedEurCents,
		newStatus: newRefundedEurCents === input.paidEurCents ? 'refunded' : 'partially_refunded'
	};
}
