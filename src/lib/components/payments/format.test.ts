// Cifras de la compra (W20): créditos por euro, créditos de la bonificación y paquete destacado.
import { describe, expect, it } from 'vitest';
import { bestPackId, bonusCreditsMicro, formatCreditsPerEuro } from './format';

describe('formatCreditsPerEuro', () => {
	it('divide los créditos (bonificación incluida) entre los euros del paquete', () => {
		expect(formatCreditsPerEuro(1000, 10_500_000_000)).toBe('1050');
		expect(formatCreditsPerEuro(2500, 27_500_000_000)).toBe('1100');
	});

	it('sin precio no hay cifra', () => {
		expect(formatCreditsPerEuro(0, 1_000_000)).toBe('');
	});
});

describe('bonusCreditsMicro', () => {
	it('separa la parte regalada de los créditos del paquete', () => {
		expect(bonusCreditsMicro(10_500_000_000, 5)).toBe(500_000_000);
		expect(bonusCreditsMicro(27_500_000_000, 10)).toBe(2_500_000_000);
	});

	it('sin bonificación es cero', () => {
		expect(bonusCreditsMicro(5_000_000_000, 0)).toBe(0);
	});
});

describe('bestPackId', () => {
	it('destaca el de mayor bonificación y, con empate, el primero', () => {
		expect(
			bestPackId([
				{ id: 'a', bonusPct: 0 },
				{ id: 'b', bonusPct: 10 },
				{ id: 'c', bonusPct: 10 }
			])
		).toBe('b');
	});

	it('sin ninguna bonificación no destaca ninguno', () => {
		expect(bestPackId([{ id: 'a', bonusPct: 0 }])).toBeNull();
		expect(bestPackId([])).toBeNull();
	});
});
