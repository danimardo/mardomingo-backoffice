// Métricas de estadísticas (BE-FR-54; T317): margen bruto, conversión USD→EUR, agrupación por día, app, operación y usuario, embudo
// semanal y acumulado, y «sin datos» distinto de cero. Reglas puras: sin base de datos ni reloj.
import { describe, expect, it } from 'vitest';
import { funnel, grossMargin, groupSum, usdMicroToEurCents } from './metrics';

describe('margen bruto', () => {
	it('es ingresos menos coste', () => {
		expect(grossMargin(10_000, 2_500)).toBe(7_500);
	});

	it('sin ingresos o sin coste conocido no hay margen: null, no cero', () => {
		expect(grossMargin(null, 2_500)).toBeNull();
		expect(grossMargin(10_000, null)).toBeNull();
	});

	it('un margen negativo se conserva', () => {
		expect(grossMargin(1_000, 1_500)).toBe(-500);
	});
});

describe('conversión USD→EUR', () => {
	it('un dólar a 0,92 son 92 céntimos', () => {
		expect(usdMicroToEurCents(1_000_000, 920_000)).toBe(92);
	});

	it('redondea al céntimo más cercano', () => {
		expect(usdMicroToEurCents(1_500_000, 920_000)).toBe(138);
	});
});

describe('agrupación', () => {
	const rows = [
		{ day: '2026-10-16', app: 'secretario', op: 'transcripcion', user: 'u1', cents: 100 },
		{ day: '2026-10-16', app: 'secretario', op: 'chat', user: 'u2', cents: 50 },
		{ day: '2026-10-17', app: 'otra', op: 'chat', user: 'u1', cents: 25 }
	];

	it('suma por día, app, operación y usuario', () => {
		expect(
			groupSum(
				rows,
				(row) => row.day,
				(row) => row.cents
			)
		).toEqual(
			new Map([
				['2026-10-16', 150],
				['2026-10-17', 25]
			])
		);
		expect(
			groupSum(
				rows,
				(row) => row.app,
				(row) => row.cents
			).get('secretario')
		).toBe(150);
		expect(
			groupSum(
				rows,
				(row) => row.op,
				(row) => row.cents
			).get('chat')
		).toBe(75);
		expect(
			groupSum(
				rows,
				(row) => row.user,
				(row) => row.cents
			).get('u1')
		).toBe(125);
	});

	it('un grupo sin filas no aparece: no se inventa un cero', () => {
		expect(
			groupSum(
				[],
				(row: { day: string }) => row.day,
				() => 1
			).get('2026-10-16')
		).toBeUndefined();
	});
});

describe('embudo', () => {
	it('acumulado: cada etapa cuenta los que llegaron a ella o a una posterior', () => {
		expect(
			funnel([
				{ stage: 'descargas', count: 100 },
				{ stage: 'registros', count: 40 },
				{ stage: 'verificados', count: 20 }
			])
		).toEqual([
			{ stage: 'descargas', count: 100, rate: 1 },
			{ stage: 'registros', count: 40, rate: 0.4 },
			{ stage: 'verificados', count: 20, rate: 0.5 }
		]);
	});

	it('sin datos en la etapa de entrada, todas las tasas son nulas (no cero)', () => {
		const result = funnel([
			{ stage: 'descargas', count: null },
			{ stage: 'registros', count: 0 }
		]);

		expect(result[0]).toEqual({ stage: 'descargas', count: null, rate: null });
		expect(result[1]).toEqual({ stage: 'registros', count: 0, rate: null });
	});
});
