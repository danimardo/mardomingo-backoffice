// Tipo de cambio USD→EUR (BE-FR-87 CA1–CA3; FR-036; R13; T145). Todo en ppm enteros, sin `float`: el CSV del BCE llega como
// texto y se convierte con cuidado de no perder decimales.
import { describe, expect, it } from 'vitest';
import {
	currentFx,
	DEFAULT_FX_USD_EUR_PPM,
	fxUsdEurPpm,
	isCurrentEcbObservation,
	parseRatePpm,
	staleWeekdays
} from './fx';

describe('parseRatePpm (texto del CSV, sin float)', () => {
	it('convierte el tipo de referencia en ppm exactos', () => {
		expect(parseRatePpm('1.0870')).toBe(1_087_000);
		expect(parseRatePpm('1')).toBe(1_000_000);
		expect(parseRatePpm('0.5')).toBe(500_000);
	});

	it('rechaza formatos que no son un decimal con punto, o con más de seis decimales', () => {
		expect(() => parseRatePpm('1,0870')).toThrow();
		expect(() => parseRatePpm('abc')).toThrow();
		expect(() => parseRatePpm('1.0870001')).toThrow();
		expect(() => parseRatePpm('')).toThrow();
		expect(() => parseRatePpm('0.000000')).toThrow();
	});
});

describe('fxUsdEurPpm (BE-FR-87)', () => {
	it('(1 / tipo BCE) × (1 + colchón), redondeado al ppm más cercano', () => {
		// 1 / 1,0870 = 0,919963; sin colchón son 919.963 ppm.
		expect(fxUsdEurPpm({ bceRatePpm: 1_087_000, bufferPpm: 0 })).toBe(919_963);
		// Con el colchón por defecto (3 %): 919.963,22 × 1,03 = 947.562,1 → 947.562.
		expect(fxUsdEurPpm({ bceRatePpm: 1_087_000, bufferPpm: 30_000 })).toBe(947_562);
	});

	it('un tipo BCE no positivo es un error de programación', () => {
		expect(() => fxUsdEurPpm({ bceRatePpm: 0, bufferPpm: 0 })).toThrow();
	});
});

describe('currentFx (vigencia: mayor effective_from ≤ ahora)', () => {
	const T1 = Date.UTC(2026, 9, 9, 16, 30);
	const T2 = Date.UTC(2026, 9, 10, 16, 30);
	const NOW = Date.UTC(2026, 9, 11, 8, 0);

	it('sin filas, el valor por defecto de la configuración (920.000 ppm)', () => {
		expect(currentFx([], NOW)).toEqual({
			usdEurPpm: DEFAULT_FX_USD_EUR_PPM,
			source: 'default',
			effectiveFrom: null
		});
		expect(DEFAULT_FX_USD_EUR_PPM).toBe(920_000);
	});

	it('gana la fila con mayor effective_from que ya ha entrado en vigor', () => {
		const rows = [
			{ usdEurPpm: 900_000, source: 'ecb' as const, effectiveFrom: T1 },
			{ usdEurPpm: 910_000, source: 'ecb' as const, effectiveFrom: T2 },
			{ usdEurPpm: 999_000, source: 'ecb' as const, effectiveFrom: Date.UTC(2026, 9, 12) }
		];

		expect(currentFx(rows, NOW)).toEqual({ usdEurPpm: 910_000, source: 'ecb', effectiveFrom: T2 });
	});

	it('un valor manual vigente sustituye al automático mientras la última fila sea manual', () => {
		const rows = [
			{ usdEurPpm: 910_000, source: 'ecb' as const, effectiveFrom: T1 },
			{ usdEurPpm: 950_000, source: 'manual' as const, effectiveFrom: T2 }
		];

		expect(currentFx(rows, NOW)).toMatchObject({ usdEurPpm: 950_000, source: 'manual' });
	});
});

describe('staleWeekdays (fin de semana y festivos no cuentan; BE-FR-87 CA2)', () => {
	it('desde un viernes, el lunes siguiente es un día laborable sin publicar', () => {
		expect(staleWeekdays('2026-10-09', '2026-10-12')).toBe(1);
	});

	it('desde un martes hasta el lunes siguiente hay cuatro días laborables sin publicar', () => {
		expect(staleWeekdays('2026-10-06', '2026-10-12')).toBe(4);
	});

	it('el mismo día, o el día siguiente de un día laborable sin fin de semana de por medio, no cuenta', () => {
		expect(staleWeekdays('2026-10-12', '2026-10-12')).toBe(0);
	});
});

describe('meses de enero y febrero (el año civil empieza en marzo para el cálculo)', () => {
	it('desde el viernes 27 de febrero de 2026 hasta el lunes 2 de marzo hay un día laborable', () => {
		expect(staleWeekdays('2026-02-27', '2026-03-02')).toBe(1);
	});
});

describe('fechas civiles no válidas', () => {
	it('una fecha que no es YYYY-MM-DD es un error, no una fecha inventada', () => {
		expect(() => staleWeekdays('09/10/2026', '2026-10-12')).toThrow();
		expect(() => isCurrentEcbObservation({ timePeriod: '2026-10-09', today: 'hoy' })).toThrow();
	});
});

describe('isCurrentEcbObservation (una observación antigua sí cuenta como fallo)', () => {
	it('un sábado, la última publicación esperada es el viernes anterior', () => {
		expect(isCurrentEcbObservation({ timePeriod: '2026-10-09', today: '2026-10-10' })).toBe(true);
		expect(isCurrentEcbObservation({ timePeriod: '2026-10-08', today: '2026-10-10' })).toBe(false);
	});

	it('un lunes, la publicación esperada es la de ese mismo día', () => {
		expect(isCurrentEcbObservation({ timePeriod: '2026-10-12', today: '2026-10-12' })).toBe(true);
		expect(isCurrentEcbObservation({ timePeriod: '2026-10-09', today: '2026-10-12' })).toBe(false);
	});
});
