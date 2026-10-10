import { describe, expect, it } from 'vitest';
import * as z from 'zod';
import fc from 'fast-check';
import { parseDateEs, dateEs } from './date-es';
import { parseDecimalEs, decimalEs } from './decimal-es';
import { repeatedField } from './repeated';

describe('decimalEs', () => {
	it('lee el formato español con miles y coma decimal', () => {
		expect(parseDecimalEs('1.234,56')).toBe(1234.56);
		expect(parseDecimalEs('-0,5')).toBe(-0.5);
		expect(parseDecimalEs('12')).toBe(12);
	});

	it('rechaza el punto como decimal y los textos sueltos', () => {
		expect(parseDecimalEs('1.5')).toBeUndefined();
		expect(parseDecimalEs('12,5,3')).toBeUndefined();
		expect(parseDecimalEs('')).toBeUndefined();
	});

	it('en el esquema, un valor inválido es un problema de validación', () => {
		expect(decimalEs.safeParse('abc').success).toBe(false);
		expect(decimalEs.safeParse('2,5')).toEqual({ success: true, data: 2.5 });
	});

	it('ida y vuelta para cualquier entero con formato de miles', () => {
		fc.assert(
			fc.property(fc.integer({ min: -999_999_999, max: 999_999_999 }), (value) => {
				const spanish = new Intl.NumberFormat('es-ES').format(value);
				expect(parseDecimalEs(spanish)).toBe(value);
			})
		);
	});
});

describe('dateEs', () => {
	it('acepta dd/mm/aaaa y devuelve el día de calendario', () => {
		expect(parseDateEs('31/12/2026')).toBe('2026-12-31');
	});

	it('acepta ISO aaaa-mm-dd', () => {
		expect(parseDateEs('2026-03-29')).toBe('2026-03-29');
	});

	it('rechaza fechas que no existen y formatos ambiguos', () => {
		expect(parseDateEs('31/02/2026')).toBeUndefined();
		expect(parseDateEs('2026/03/29')).toBeUndefined();
		expect(parseDateEs('ayer')).toBeUndefined();
	});

	it('en el esquema devuelve un problema de validación para una fecha inválida', () => {
		expect(dateEs.safeParse('30/02/2026').success).toBe(false);
	});
});

describe('repeatedField', () => {
	const schema = z.object({ etiquetas: repeatedField(z.string()) });

	it('un valor único se convierte en lista y uno ausente en lista vacía', () => {
		expect(schema.parse({ etiquetas: 'a' })).toEqual({ etiquetas: ['a'] });
		expect(schema.parse({})).toEqual({ etiquetas: [] });
	});

	it('una lista se mantiene', () => {
		expect(schema.parse({ etiquetas: ['a', 'b'] })).toEqual({ etiquetas: ['a', 'b'] });
	});
});
