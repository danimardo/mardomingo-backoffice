// Contracargo (BE-FR-28; T228): retira lo que quede en la bolsa de la compra y pasa el resto a deuda, SIN el tope max_debt.
// Supuesto de H-12, documentado aquí: lo que el contracargo intenta recuperar son los créditos de la compra menos los ya
// retirados por reembolsos. La cuenta queda bloqueada hasta revisión del administrador.
import { describe, expect, it } from 'vitest';
import { applyChargeback } from './chargeback';

describe('applyChargeback', () => {
	it('si la bolsa tiene todo el saldo de la compra, no hay deuda', () => {
		expect(
			applyChargeback({
				purchaseCreditsMicro: 10_500_000_000,
				refundedCreditsMicro: 0,
				bucketRemainingMicro: 10_500_000_000
			})
		).toEqual({
			withdrawnMicro: 10_500_000_000,
			debtAddedMicro: 0,
			accountBlocked: true,
			status: 'chargeback'
		});
	});

	it('lo que no alcanza en la bolsa pasa a deuda, sin tope', () => {
		expect(
			applyChargeback({
				purchaseCreditsMicro: 10_500_000_000,
				refundedCreditsMicro: 0,
				bucketRemainingMicro: 4_000_000_000
			})
		).toEqual({
			withdrawnMicro: 4_000_000_000,
			debtAddedMicro: 6_500_000_000,
			accountBlocked: true,
			status: 'chargeback'
		});
	});

	it('lo ya devuelto por reembolso no se cuenta dos veces', () => {
		expect(
			applyChargeback({
				purchaseCreditsMicro: 10_000_000_000,
				refundedCreditsMicro: 4_000_000_000,
				bucketRemainingMicro: 6_000_000_000
			})
		).toEqual({
			withdrawnMicro: 6_000_000_000,
			debtAddedMicro: 0,
			accountBlocked: true,
			status: 'chargeback'
		});
	});

	it('una bolsa vacía convierte todo lo recuperable en deuda', () => {
		expect(
			applyChargeback({
				purchaseCreditsMicro: 5_000_000_000,
				refundedCreditsMicro: 0,
				bucketRemainingMicro: 0
			})
		).toEqual({
			withdrawnMicro: 0,
			debtAddedMicro: 5_000_000_000,
			accountBlocked: true,
			status: 'chargeback'
		});
	});
});
