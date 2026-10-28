// Reembolso manual de una compra (BE-FR-27; T228, D01, D02): en compras reales no se devuelve más de lo pagado menos lo ya
// devuelto, y el estado pasa a refunded o a partially_refunded; en compras simuladas no hay importe y solo se reembolsa una vez.
// Los créditos a retirar los fija el administrador (D01): aquí solo se comprueba que no sean negativos; el saldo de la bolsa lo
// comprueba `credits` al retirar.
import { describe, expect, it } from 'vitest';
import { planRefund, type RefundInput, type RefundStatus } from './refund';

const REAL: RefundInput = {
	simulated: false,
	status: 'completed',
	paidEurCents: 1000,
	alreadyRefundedEurCents: 0,
	amountEurCents: 400,
	creditsToRemoveMicro: 4_000_000_000
};

const SIMULATED: RefundInput = {
	simulated: true,
	status: 'completed',
	paidEurCents: 1000,
	alreadyRefundedEurCents: 0,
	amountEurCents: 0,
	creditsToRemoveMicro: 10_500_000_000
};

describe('planRefund en compras reales (D01)', () => {
	it('un reembolso parcial deja la compra como partially_refunded', () => {
		expect(planRefund(REAL)).toEqual({
			ok: true,
			newRefundedEurCents: 400,
			newStatus: 'partially_refunded'
		});
	});

	it('devolver todo lo pagado deja la compra como refunded', () => {
		expect(planRefund({ ...REAL, amountEurCents: 1000 })).toEqual({
			ok: true,
			newRefundedEurCents: 1000,
			newStatus: 'refunded'
		});
	});

	it('el importe puede ser exactamente lo que queda por devolver', () => {
		expect(planRefund({ ...REAL, alreadyRefundedEurCents: 700, amountEurCents: 300 })).toEqual({
			ok: true,
			newRefundedEurCents: 1000,
			newStatus: 'refunded'
		});
	});

	it('un céntimo más de lo que queda por devolver se rechaza', () => {
		expect(planRefund({ ...REAL, alreadyRefundedEurCents: 700, amountEurCents: 301 })).toEqual({
			ok: false,
			reason: 'amount_exceeds_paid'
		});
	});

	it('un importe de 0 o negativo no es un reembolso', () => {
		expect(planRefund({ ...REAL, amountEurCents: 0 })).toEqual({
			ok: false,
			reason: 'amount_not_positive'
		});
		expect(planRefund({ ...REAL, amountEurCents: -1 })).toEqual({
			ok: false,
			reason: 'amount_not_positive'
		});
	});

	it('un céntimo es el importe mínimo válido', () => {
		expect(planRefund({ ...REAL, amountEurCents: 1 })).toEqual({
			ok: true,
			newRefundedEurCents: 1,
			newStatus: 'partially_refunded'
		});
	});

	it('se puede devolver dinero sin retirar créditos (0 créditos a retirar)', () => {
		expect(planRefund({ ...REAL, creditsToRemoveMicro: 0 })).toEqual({
			ok: true,
			newRefundedEurCents: 400,
			newStatus: 'partially_refunded'
		});
	});

	it('retirar un número negativo de créditos se rechaza', () => {
		expect(planRefund({ ...REAL, creditsToRemoveMicro: -1 })).toEqual({
			ok: false,
			reason: 'credits_negative'
		});
	});
});

describe('planRefund en compras simuladas (D02)', () => {
	it('solo retira créditos y deja la compra como refunded sin importe', () => {
		expect(planRefund(SIMULATED)).toEqual({
			ok: true,
			newRefundedEurCents: 0,
			newStatus: 'refunded'
		});
	});

	it('un céntimo de importe no se acepta en una compra simulada', () => {
		expect(planRefund({ ...SIMULATED, amountEurCents: 1 })).toEqual({
			ok: false,
			reason: 'amount_not_allowed'
		});
	});

	it('sin créditos a retirar no hay nada que reembolsar', () => {
		expect(planRefund({ ...SIMULATED, creditsToRemoveMicro: 0 })).toEqual({
			ok: false,
			reason: 'nothing_to_refund'
		});
	});

	it('una compra simulada solo se reembolsa una vez', () => {
		expect(planRefund({ ...SIMULATED, status: 'refunded' })).toEqual({
			ok: false,
			reason: 'not_completed'
		});
	});

	it('solo se reembolsa una compra simulada completada', () => {
		const statuses: RefundStatus[] = ['pending', 'partially_refunded', 'chargeback'];
		for (const status of statuses) {
			expect(planRefund({ ...SIMULATED, status })).toEqual({
				ok: false,
				reason: 'not_completed'
			});
		}
	});
});
