// IVA incluido en el precio (BE-FR-25 CA5, D-17; T226): 21 % en España. El desglose cuadra siempre: base + cuota = total.
import { describe, expect, it } from 'vitest';
import { splitVat } from './vat';

describe('splitVat (ES, 21 % incluido)', () => {
	it('10 € se desglosa en 8,26 € de base y 1,74 € de cuota', () => {
		expect(splitVat({ totalEurCents: 1000, country: 'ES' })).toEqual({
			baseEurCents: 826,
			vatEurCents: 174
		});
	});

	it('25 € se desglosa en 20,66 € de base y 4,34 € de cuota', () => {
		expect(splitVat({ totalEurCents: 2500, country: 'ES' })).toEqual({
			baseEurCents: 2066,
			vatEurCents: 434
		});
	});

	it('5 € se desglosa en 4,13 € de base y 0,87 € de cuota', () => {
		expect(splitVat({ totalEurCents: 500, country: 'ES' })).toEqual({
			baseEurCents: 413,
			vatEurCents: 87
		});
	});

	it('base y cuota siempre suman el total', () => {
		for (let total = 1; total <= 5000; total += 37) {
			const split = splitVat({ totalEurCents: total, country: 'ES' });
			expect(split.baseEurCents + split.vatEurCents).toBe(total);
		}
	});

	it('un país distinto de ES no se calcula: no se inventa un tratamiento fiscal', () => {
		expect(() => splitVat({ totalEurCents: 1000, country: 'FR' })).toThrow(RangeError);
	});

	it('un total no positivo no se desglosa', () => {
		expect(() => splitVat({ totalEurCents: 0, country: 'ES' })).toThrow(RangeError);
	});
});
