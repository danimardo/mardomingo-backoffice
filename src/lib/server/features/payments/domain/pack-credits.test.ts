// Créditos de un paquete (BE-FR-23, BE-FR-25 CA1; T226): precio en céntimos × créditos por euro × (1 + bonificación),
// en micro-créditos y con aritmética exacta.
import { describe, expect, it } from 'vitest';
import { packCreditsMicro } from './pack-credits';

const CREDITS_PER_EUR = 1000;

describe('packCreditsMicro', () => {
	it('un pack de 5 € sin bonificación da 5.000 créditos', () => {
		expect(
			packCreditsMicro({ priceEurCents: 500, creditsPerEur: CREDITS_PER_EUR, bonusPpm: 0 })
		).toBe(5_000_000_000);
	});

	it('un pack de 10 € con +5 % da 10.500 créditos', () => {
		expect(
			packCreditsMicro({ priceEurCents: 1000, creditsPerEur: CREDITS_PER_EUR, bonusPpm: 50_000 })
		).toBe(10_500_000_000);
	});

	it('un pack de 25 € con +10 % da 27.500 créditos', () => {
		expect(
			packCreditsMicro({ priceEurCents: 2500, creditsPerEur: CREDITS_PER_EUR, bonusPpm: 100_000 })
		).toBe(27_500_000_000);
	});

	it('usa aritmética exacta: sin decimales perdidos con cifras grandes', () => {
		expect(
			packCreditsMicro({ priceEurCents: 99_999, creditsPerEur: 1000, bonusPpm: 123_456 })
		).toBe(99_999 * 10 * (1_000_000 + 123_456));
	});

	it('un precio no positivo es un error', () => {
		expect(() =>
			packCreditsMicro({ priceEurCents: 0, creditsPerEur: CREDITS_PER_EUR, bonusPpm: 0 })
		).toThrow(RangeError);
	});
});
