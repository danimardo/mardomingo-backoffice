import { describe, expect, it } from 'vitest';
import { toEpochMs } from '$lib/shared/time';
import { civilDateInMadrid, createSystemClock } from './clock';
import { createFakeClock } from './fake';

describe('día civil en Europe/Madrid', () => {
	it('el día de Madrid es el de la zona horaria local, no el de UTC', () => {
		// 2026-10-10 22:30 UTC son las 00:30 del 11 de octubre en Madrid (CEST, UTC+2).
		const instant = toEpochMs(Date.UTC(2026, 9, 10, 22, 30));

		expect(civilDateInMadrid(instant)).toBe('2026-10-11');
	});

	it('funciona el día del cambio de hora de primavera', () => {
		// El 29 de marzo de 2026 a las 00:30 de Madrid (CET, UTC+1) = 2026-03-28 23:30 UTC.
		const instant = toEpochMs(Date.UTC(2026, 2, 28, 23, 30));

		expect(civilDateInMadrid(instant)).toBe('2026-03-29');
	});

	it('el día del cambio de hora de otoño incluye las 25 horas sin saltar de día', () => {
		// 2026-10-25 00:30 de Madrid (CEST) = 2026-10-24 22:30 UTC.
		const instant = toEpochMs(Date.UTC(2026, 9, 24, 22, 30));

		expect(civilDateInMadrid(instant)).toBe('2026-10-25');
	});
});

describe('reloj falso', () => {
	it('fija el instante y lo avanza a mano', () => {
		const clock = createFakeClock(toEpochMs(1_000));

		expect(clock.now()).toBe(1_000);
		clock.advance(500);
		expect(clock.now()).toBe(1_500);
		clock.set(toEpochMs(42));
		expect(clock.now()).toBe(42);
	});

	it('calcula el día civil desde su instante actual', () => {
		const clock = createFakeClock(toEpochMs(Date.UTC(2026, 9, 10, 22, 30)));

		expect(clock.today()).toBe('2026-10-11');
		clock.advance(-2 * 60 * 60 * 1000);
		expect(clock.today()).toBe('2026-10-10');
	});

	it('rechaza avanzar a un instante negativo', () => {
		const clock = createFakeClock(toEpochMs(10));

		expect(() => {
			clock.advance(-20);
		}).toThrow();
	});
});

describe('reloj real', () => {
	it('devuelve un instante no negativo y un día civil coherente con él', () => {
		const clock = createSystemClock();
		const before = Date.now();
		const now = clock.now();

		expect(now).toBeGreaterThanOrEqual(before);
		expect(clock.today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});
