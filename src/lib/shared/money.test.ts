import { describe, expect, it } from 'vitest';
import {
	InvalidAmountError,
	MICRO_PER_CREDIT,
	toEurCents,
	toMicro,
	toMicroUsd,
	toPpm
} from './money';

describe('importes en enteros escalados', () => {
	it('define la escala de 1 crédito en micro-créditos', () => {
		expect(MICRO_PER_CREDIT).toBe(1_000_000);
	});

	it('acepta microcréditos negativos (saldos con deuda) y enteros seguros', () => {
		expect(toMicro(3_236_000)).toBe(3_236_000);
		expect(toMicro(-3_236_000)).toBe(-3_236_000);
		expect(toMicro(0)).toBe(0);
	});

	it('rechaza decimales, no finitos y enteros fuera del rango seguro', () => {
		expect(() => toMicro(0.5)).toThrow(InvalidAmountError);
		expect(() => toMicro(Number.NaN)).toThrow(InvalidAmountError);
		expect(() => toMicro(Number.POSITIVE_INFINITY)).toThrow(InvalidAmountError);
		expect(() => toMicro(Number.MAX_SAFE_INTEGER + 1)).toThrow(InvalidAmountError);
	});

	it('los importes que no pueden ser negativos rechazan los negativos', () => {
		expect(toEurCents(1000)).toBe(1000);
		expect(toMicroUsd(400)).toBe(400);
		expect(toPpm(2_000_000)).toBe(2_000_000);
		expect(() => toEurCents(-1)).toThrow(InvalidAmountError);
		expect(() => toMicroUsd(-1)).toThrow(InvalidAmountError);
		expect(() => toPpm(-1)).toThrow(InvalidAmountError);
	});

	it('identifica el importe inválido por su nombre, no por su valor', () => {
		let caught: unknown;
		try {
			toEurCents(-7.5);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(InvalidAmountError);
		expect((caught as InvalidAmountError).message).toContain('EurCents');
		expect((caught as InvalidAmountError).message).not.toContain('7.5');
	});
});
