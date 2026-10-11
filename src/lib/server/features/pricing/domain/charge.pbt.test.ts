// Propiedades del cobro (Historias 15.8; T146): monótono en el coste, siempre un entero seguro, y nunca por debajo del
// valor exacto racional (el redondeo solo sube, en el último paso).
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { computeCharge } from './charge';

const SEED = 20261011;

const inputs = fc.record({
	costMicroUsd: fc.integer({ min: 0, max: 1_000_000_000 }),
	providerFeePpm: fc.integer({ min: 0, max: 200_000 }),
	fxUsdEurPpm: fc.integer({ min: 1, max: 2_000_000 }),
	marginPpm: fc.integer({ min: 1, max: 5_000_000 }),
	creditsPerEurUsage: fc.integer({ min: 1, max: 10_000 })
});

describe('propiedades del cobro (T146)', () => {
	it('monótono: más coste nunca cobra menos', () => {
		fc.assert(
			fc.property(inputs, fc.integer({ min: 0, max: 1_000_000_000 }), (base, extra) => {
				const lower = computeCharge(base);
				const higher = computeCharge({ ...base, costMicroUsd: base.costMicroUsd + extra });
				expect(higher).toBeGreaterThanOrEqual(lower);
			}),
			{ seed: SEED, numRuns: 300 }
		);
	});

	it('siempre un entero seguro', () => {
		fc.assert(
			fc.property(inputs, (input) => {
				expect(Number.isSafeInteger(computeCharge(input))).toBe(true);
			}),
			{ seed: SEED, numRuns: 300 }
		);
	});

	it('nunca por debajo del valor exacto: el redondeo solo sube', () => {
		fc.assert(
			fc.property(inputs, (input) => {
				const charge = computeCharge(input);
				// Valor exacto en µc = coste × (1 + fee) × fx × margen × créditos_por_euro, con denominador 10^18.
				const numerator =
					BigInt(input.costMicroUsd) *
					BigInt(1_000_000 + input.providerFeePpm) *
					BigInt(input.fxUsdEurPpm) *
					BigInt(input.marginPpm) *
					BigInt(input.creditsPerEurUsage);
				const denominator = BigInt(10) ** BigInt(18);
				expect(BigInt(charge) * denominator).toBeGreaterThanOrEqual(numerator);
			}),
			{ seed: SEED, numRuns: 300 }
		);
	});
});
