// Tiempo total de una operación con reintentos y respaldos (BE-FR-77 CA4; T161).
import { describe, expect, it } from 'vitest';
import { fitWithin, totalTimeoutMs } from './total-timeout';

describe('totalTimeoutMs', () => {
	it('suma los tiempos de cada intento y su espera previa', () => {
		expect(
			totalTimeoutMs([
				{ timeoutMs: 45_000, waitBeforeMs: 0 },
				{ timeoutMs: 45_000, waitBeforeMs: 2_000 }
			])
		).toBe(92_000);
	});

	it('sin intentos el tiempo es cero', () => {
		expect(totalTimeoutMs([])).toBe(0);
	});

	it('rechaza tiempos negativos o no enteros', () => {
		expect(() => totalTimeoutMs([{ timeoutMs: -1, waitBeforeMs: 0 }])).toThrow(RangeError);
		expect(() => totalTimeoutMs([{ timeoutMs: 1.5, waitBeforeMs: 0 }])).toThrow(RangeError);
		expect(() => totalTimeoutMs([{ timeoutMs: 1, waitBeforeMs: -1 }])).toThrow(RangeError);
	});
});

describe('fitWithin', () => {
	it('recorta el último intento para no pasar del presupuesto y descarta lo que no cabe', () => {
		const attempts = [
			{ timeoutMs: 45_000, waitBeforeMs: 0 },
			{ timeoutMs: 45_000, waitBeforeMs: 2_000 },
			{ timeoutMs: 45_000, waitBeforeMs: 4_000 },
			{ timeoutMs: 60_000, waitBeforeMs: 8_000 }
		];
		const fitted = fitWithin(attempts, 100_000);

		expect(fitted).toEqual([
			{ timeoutMs: 45_000, waitBeforeMs: 0 },
			{ timeoutMs: 45_000, waitBeforeMs: 2_000 },
			{ timeoutMs: 4_000, waitBeforeMs: 4_000 }
		]);
		expect(totalTimeoutMs(fitted)).toBe(100_000);
	});

	it('si todo cabe, no cambia nada', () => {
		const attempts = [{ timeoutMs: 45_000, waitBeforeMs: 0 }];
		expect(fitWithin(attempts, 60_000)).toEqual(attempts);
	});
});
