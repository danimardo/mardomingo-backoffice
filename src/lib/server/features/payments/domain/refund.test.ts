// Reembolso manual de una compra (BE-FR-27; T228): no supera lo pagado ni el saldo no consumido de la bolsa de esa compra,
// y mueve el estado de la compra según lo devuelto.
import { describe, expect, it } from 'vitest';
import { planRefund } from './refund';

const BASE = {
	paidEurCents: 1000,
	alreadyRefundedEurCents: 0,
	bucketRemainingMicro: 10_500_000_000
};

describe('planRefund', () => {
	it('un reembolso parcial deja la compra como partially_refunded', () => {
		expect(
			planRefund({ ...BASE, amountEurCents: 400, creditsToWithdrawMicro: 4_000_000_000 })
		).toEqual({
			ok: true,
			newRefundedEurCents: 400,
			newStatus: 'partially_refunded'
		});
	});

	it('devolver todo lo pagado deja la compra como refunded', () => {
		expect(planRefund({ ...BASE, amountEurCents: 1000, creditsToWithdrawMicro: 0 })).toMatchObject({
			ok: true,
			newRefundedEurCents: 1000,
			newStatus: 'refunded'
		});
	});

	it('no se puede devolver más que lo pagado menos lo ya devuelto', () => {
		expect(
			planRefund({
				...BASE,
				alreadyRefundedEurCents: 700,
				amountEurCents: 400,
				creditsToWithdrawMicro: 0
			})
		).toEqual({ ok: false, reason: 'amount_exceeds_paid' });
	});

	it('no se pueden retirar más créditos que el saldo no consumido de la bolsa', () => {
		expect(
			planRefund({
				...BASE,
				amountEurCents: 100,
				creditsToWithdrawMicro: BASE.bucketRemainingMicro + 1
			})
		).toEqual({ ok: false, reason: 'credits_exceed_bucket' });
	});

	it('un importe no positivo no es un reembolso', () => {
		expect(planRefund({ ...BASE, amountEurCents: 0, creditsToWithdrawMicro: 0 })).toEqual({
			ok: false,
			reason: 'amount_not_positive'
		});
	});
});
