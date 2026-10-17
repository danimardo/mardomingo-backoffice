import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { toCivilDate, toEpochMs } from './time';
import {
	addDays,
	civilDateOf,
	civilFromDays,
	daysFromCivil,
	madridMidnight,
	startOfMadridDay
} from './dates';

// Instantes de referencia en ms UTC, calculados aparte (no con este módulo).
const OCT_24_22_UTC = toEpochMs(1_792_879_200_000); // 2026-10-25 00:00 en Madrid (CEST)
const OCT_25_23_UTC = toEpochMs(1_792_969_200_000); // 2026-10-26 00:00 en Madrid (CET)
const MAR_27_23_UTC = toEpochMs(1_806_188_400_000); // 2027-03-28 00:00 en Madrid (CET)
const MAR_28_22_UTC = toEpochMs(1_806_271_200_000); // 2027-03-29 00:00 en Madrid (CEST)
const OCT_24_21_59_59_UTC = toEpochMs(1_792_879_199_000); // antes de la medianoche de Madrid

describe('día civil de Madrid', () => {
	it('un instante a las 00:30 de Madrid cae en el día de Madrid, no el de UTC', () => {
		expect(civilDateOf(toEpochMs(OCT_24_22_UTC + 30 * 60_000))).toBe('2026-10-25');
	});

	it('un instante justo antes de la medianoche de Madrid sigue en el día anterior', () => {
		expect(civilDateOf(OCT_24_21_59_59_UTC)).toBe('2026-10-24');
	});

	it('el día del cambio a hora de invierno dura 25 horas', () => {
		const start = madridMidnight(toCivilDate('2026-10-25'));
		const end = madridMidnight(toCivilDate('2026-10-26'));

		expect(end - start).toBe(25 * 3_600_000);
		expect(start).toBe(OCT_24_22_UTC);
		expect(end).toBe(OCT_25_23_UTC);
	});

	it('el día del cambio a hora de verano dura 23 horas', () => {
		const start = madridMidnight(toCivilDate('2027-03-28'));
		const end = madridMidnight(toCivilDate('2027-03-29'));

		expect(end - start).toBe(23 * 3_600_000);
		expect(start).toBe(MAR_27_23_UTC);
		expect(end).toBe(MAR_28_22_UTC);
	});

	it('startOfMadridDay devuelve la medianoche del día que contiene el instante', () => {
		const inside = toEpochMs(OCT_24_22_UTC + 5 * 3_600_000);

		expect(startOfMadridDay(inside)).toBe(OCT_24_22_UTC);
	});

	it('la medianoche de un día cae en ese mismo día de Madrid', () => {
		expect(civilDateOf(madridMidnight(toCivilDate('2026-10-25')))).toBe('2026-10-25');
		expect(civilDateOf(madridMidnight(toCivilDate('2027-03-29')))).toBe('2027-03-29');
	});
});

describe('aritmética de días civiles', () => {
	it('suma días cruzando meses, años y el 29 de febrero', () => {
		expect(addDays(toCivilDate('2026-12-31'), 1)).toBe('2027-01-01');
		expect(addDays(toCivilDate('2028-02-28'), 1)).toBe('2028-02-29');
		expect(addDays(toCivilDate('2027-03-01'), -1)).toBe('2027-02-28');
	});

	it('daysFromCivil y civilFromDays son inversas', () => {
		expect(daysFromCivil(1970, 1, 1)).toBe(0);
		expect(civilFromDays(0)).toEqual({ year: 1970, month: 1, day: 1 });
	});
});

describe('propiedades de coherencia', () => {
	it('round-trip: el día civil de la medianoche de un día es ese mismo día', () => {
		fc.assert(
			// Desde 1970-01-02: la medianoche de Madrid del 1 de enero de 1970 cae en un instante negativo, que `EpochMs` no admite.
			fc.property(fc.integer({ min: 1, max: 30_000 }), (days) => {
				const { year, month, day } = civilFromDays(days);
				const civil = addDays(toCivilDate('1970-01-01'), days);
				expect(civil).toBe(
					`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
				);
				expect(civilDateOf(madridMidnight(civil))).toBe(civil);
			})
		);
	});

	it('todo instante cae entre la medianoche de su día y la del día siguiente', () => {
		fc.assert(
			fc.property(fc.integer({ min: 1_577_836_800_000, max: 2_051_222_400_000 }), (ms) => {
				const instant = toEpochMs(ms);
				const day = civilDateOf(instant);
				expect(madridMidnight(day)).toBeLessThanOrEqual(instant);
				expect(instant).toBeLessThan(madridMidnight(addDays(day, 1)));
				expect(startOfMadridDay(instant)).toBe(madridMidnight(day));
			})
		);
	});

	it('la duración de cada día de Madrid es de 23, 24 o 25 horas', () => {
		fc.assert(
			fc.property(fc.integer({ min: 0, max: 3_650 }), (offset) => {
				const day = addDays(toCivilDate('2024-01-01'), offset);
				const length = madridMidnight(addDays(day, 1)) - madridMidnight(day);
				expect([23, 24, 25].map((h) => h * 3_600_000)).toContain(length);
			})
		);
	});
});
