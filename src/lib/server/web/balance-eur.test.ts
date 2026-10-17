// Equivalencia en euros del saldo (W18; BE-FR-22; T258). Un crédito vale lo que cuesta en el paquete activo más barato por crédito.
import { describe, expect, it } from 'vitest';
import { balanceEurCentsOf } from './balance-eur';

const CREDIT = 1_000_000;

describe('balanceEurCentsOf', () => {
	it('usa el paquete más barato por crédito', () => {
		const packs = [
			{ priceCents: 1000, creditsMicro: 10_500 * CREDIT }, // 10 € por 10.500 créditos
			{ priceCents: 500, creditsMicro: 4_800 * CREDIT } // 5 € por 4.800 créditos: más caro por crédito
		];

		// 1.000 créditos al precio de 10 € / 10.500 = 0,952… € → 95 céntimos
		expect(balanceEurCentsOf(1_000 * CREDIT, packs)).toBe(95);
	});

	it('sin paquetes no hay equivalencia', () => {
		expect(balanceEurCentsOf(1_000 * CREDIT, [])).toBeNull();
	});

	it('un saldo cero o negativo vale cero céntimos', () => {
		const packs = [{ priceCents: 1000, creditsMicro: 10_500 * CREDIT }];

		expect(balanceEurCentsOf(0, packs)).toBe(0);
		expect(balanceEurCentsOf(-5 * CREDIT, packs)).toBe(0);
	});
});
