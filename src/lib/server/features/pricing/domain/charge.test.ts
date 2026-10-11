// Fórmula de cobro (BE-FR-19, BE-FR-22; D-07; T142). Los ejemplos de BE-FR-22 son fixtures exactos: el resultado en
// micro-créditos debe salir igual, sin redondeos intermedios.
import { describe, expect, it } from 'vitest';
import { computeCharge, marginFor } from './charge';

const DEFAULTS = {
	providerFeePpm: 55_000,
	fxUsdEurPpm: 920_000,
	marginPpm: 2_000_000,
	creditsPerEurUsage: 1000
};

describe('computeCharge (BE-FR-19, BE-FR-22)', () => {
	it('fix de un párrafo con OpenRouter: 400 µUSD cobran 776.480 µc (0,8 créditos)', () => {
		expect(computeCharge({ costMicroUsd: 400, ...DEFAULTS })).toBe(776_480);
	});

	it('transcripción de 2 min a 0,001 USD/min (Mistral, sin comisión): 2.000 µUSD cobran 3.680.000 µc', () => {
		expect(computeCharge({ costMicroUsd: 2_000, ...DEFAULTS, providerFeePpm: 0 })).toBe(3_680_000);
	});

	it('prompt PRO largo de 0,03 USD cobra 58.236.000 µc (58 créditos)', () => {
		expect(computeCharge({ costMicroUsd: 30_000, ...DEFAULTS })).toBe(58_236_000);
	});

	it('un coste cero no cobra nada', () => {
		expect(computeCharge({ costMicroUsd: 0, ...DEFAULTS })).toBe(0);
	});

	it('el redondeo sube al entero siguiente solo en el último paso (ceil a µc)', () => {
		// 1 µUSD con los valores por defecto da 1.941,2 µc: el cobro es 1.942 µc, nunca 1.941.
		expect(computeCharge({ costMicroUsd: 1, ...DEFAULTS })).toBe(1942);
	});

	it('credits_per_eur_usage es independiente de credits_per_eur_purchase: solo entra el de consumo', () => {
		const normal = computeCharge({ costMicroUsd: 400, ...DEFAULTS });
		const doubled = computeCharge({ costMicroUsd: 400, ...DEFAULTS, creditsPerEurUsage: 2000 });

		expect(doubled).toBe(normal * 2);
	});

	it('un resultado que no cabe en un entero seguro no se devuelve en silencio', () => {
		expect(() =>
			computeCharge({
				costMicroUsd: Number.MAX_SAFE_INTEGER,
				...DEFAULTS,
				marginPpm: 2_000_000_000
			})
		).toThrow();
	});

	it('un coste negativo o no entero es un error de programación', () => {
		expect(() => computeCharge({ costMicroUsd: -1, ...DEFAULTS })).toThrow();
		expect(() => computeCharge({ costMicroUsd: 1.5, ...DEFAULTS })).toThrow();
	});
});

describe('marginFor (BE-FR-19)', () => {
	it('el margen de la operación gana al global; sin margen de operación se usa el global', () => {
		expect(marginFor({ operationMarginPpm: 3_000_000, globalMarginPpm: 2_000_000 })).toBe(
			3_000_000
		);
		expect(marginFor({ operationMarginPpm: null, globalMarginPpm: 2_000_000 })).toBe(2_000_000);
	});
});
