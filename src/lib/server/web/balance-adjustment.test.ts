// Vista previa del ajuste de saldo (W36; T307): un ingreso liquida primero la deuda, una resta no supera el disponible y
// nunca crea deuda, y un importe no positivo no se acepta.
import { describe, expect, it } from 'vitest';
import { previewAdjustment } from './balance-adjustment';

const BASE = { balanceMicro: 10_000_000, debtMicro: 0, availableMicro: 10_000_000 };

describe('vista previa del ajuste de saldo', () => {
	it('un ingreso suma al saldo y no liquida deuda si no hay', () => {
		expect(previewAdjustment({ ...BASE, direction: 'credit', amountMicro: 5_000_000 })).toEqual({
			ok: true,
			balanceBeforeMicro: 10_000_000,
			balanceAfterMicro: 15_000_000,
			debtSettledMicro: 0
		});
	});

	it('un ingreso liquida primero la deuda y el resto suma al saldo', () => {
		expect(
			previewAdjustment({
				balanceMicro: 0,
				debtMicro: 3_000_000,
				availableMicro: 0,
				direction: 'credit',
				amountMicro: 5_000_000
			})
		).toEqual({
			ok: true,
			balanceBeforeMicro: 0,
			balanceAfterMicro: 5_000_000,
			debtSettledMicro: 3_000_000
		});
	});

	it('una resta baja el saldo', () => {
		expect(previewAdjustment({ ...BASE, direction: 'debit', amountMicro: 4_000_000 })).toEqual({
			ok: true,
			balanceBeforeMicro: 10_000_000,
			balanceAfterMicro: 6_000_000,
			debtSettledMicro: 0
		});
	});

	it('una resta mayor que el disponible se rechaza y nunca crea deuda', () => {
		expect(
			previewAdjustment({
				balanceMicro: 10_000_000,
				debtMicro: 0,
				availableMicro: 2_000_000,
				direction: 'debit',
				amountMicro: 3_000_000
			})
		).toEqual({ ok: false, reason: 'exceeds_available' });
	});

	it('un importe cero, negativo o fraccionario no se acepta', () => {
		for (const amountMicro of [0, -1, 1.5]) {
			expect(previewAdjustment({ ...BASE, direction: 'credit', amountMicro })).toEqual({
				ok: false,
				reason: 'amount_invalid'
			});
		}
	});
});
