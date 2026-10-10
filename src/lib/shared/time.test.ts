import { describe, expect, it } from 'vitest';
import { InvalidTimeError, daysInMonth, isLeapYear, toCivilDate, toEpochMs } from './time';

describe('instantes (EpochMs)', () => {
	it('acepta milisegundos UTC enteros y no negativos', () => {
		expect(toEpochMs(0)).toBe(0);
		expect(toEpochMs(1_791_659_000_000)).toBe(1_791_659_000_000);
	});

	it('rechaza negativos, decimales y no finitos', () => {
		expect(() => toEpochMs(-1)).toThrow(InvalidTimeError);
		expect(() => toEpochMs(1.5)).toThrow(InvalidTimeError);
		expect(() => toEpochMs(Number.NaN)).toThrow(InvalidTimeError);
	});
});

describe('años bisiestos y días del mes', () => {
	it('aplica la regla gregoriana (cada 4 años, salvo los centenarios no divisibles por 400)', () => {
		expect(isLeapYear(2024)).toBe(true);
		expect(isLeapYear(2025)).toBe(false);
		expect(isLeapYear(1900)).toBe(false);
		expect(isLeapYear(2000)).toBe(true);
	});

	it('devuelve los días de cada mes, también febrero en años bisiestos', () => {
		expect(daysInMonth(2024, 2)).toBe(29);
		expect(daysInMonth(2025, 2)).toBe(28);
		expect(daysInMonth(2026, 4)).toBe(30);
		expect(daysInMonth(2026, 12)).toBe(31);
	});
});

describe('días civiles (CivilDate)', () => {
	it('acepta fechas YYYY-MM-DD válidas, incluido el 29 de febrero de un año bisiesto', () => {
		expect(toCivilDate('2026-10-10')).toBe('2026-10-10');
		expect(toCivilDate('2024-02-29')).toBe('2024-02-29');
	});

	it('rechaza formatos que no son YYYY-MM-DD', () => {
		expect(() => toCivilDate('10/10/2026')).toThrow(InvalidTimeError);
		expect(() => toCivilDate('2026-10-1')).toThrow(InvalidTimeError);
		expect(() => toCivilDate('2026-10-10T00:00:00Z')).toThrow(InvalidTimeError);
	});

	it('rechaza fechas que no existen en el calendario', () => {
		expect(() => toCivilDate('2025-02-29')).toThrow(InvalidTimeError);
		expect(() => toCivilDate('2026-04-31')).toThrow(InvalidTimeError);
		expect(() => toCivilDate('2026-13-01')).toThrow(InvalidTimeError);
		expect(() => toCivilDate('2026-00-10')).toThrow(InvalidTimeError);
	});

	it('identifica el valor inválido por el tipo, no por su contenido', () => {
		let caught: unknown;
		try {
			toCivilDate('2026-02-31');
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(InvalidTimeError);
		expect((caught as InvalidTimeError).message).toContain('CivilDate');
		expect((caught as InvalidTimeError).message).not.toContain('2026-02-31');
	});
});
