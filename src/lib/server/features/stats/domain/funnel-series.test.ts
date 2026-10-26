// Embudo por semanas (W45, T320): semanas ISO de lunes a domingo, modo semanal y acumulado, y etapas sin datos nulas y no cero.
import { describe, expect, it } from 'vitest';
import { funnelByWeek, mondayOf, type FunnelStageName } from './funnel-series';

const NONE: Record<FunnelStageName, null> = {
	descargas: null,
	altas: null,
	verificadas: null,
	primer_login: null,
	primera_operacion: null
};

describe('semanas del embudo (T320)', () => {
	it('un domingo pertenece a la semana que empezó el lunes anterior, y un lunes empieza la suya', () => {
		expect(mondayOf('2026-10-18')).toBe('2026-10-12'); // domingo
		expect(mondayOf('2026-10-19')).toBe('2026-10-19'); // lunes
		expect(mondayOf('2026-10-25')).toBe('2026-10-19'); // domingo siguiente
	});

	it('el cálculo de la semana sirve también en años bisiestos y en el cambio de año', () => {
		expect(mondayOf('2028-02-29')).toBe('2028-02-28'); // martes
		expect(mondayOf('2027-01-01')).toBe('2026-12-28'); // viernes
		expect(mondayOf('1970-01-01')).toBe('1969-12-29'); // jueves
	});

	it('modo semanal: cuenta por semana; modo acumulado: suma hasta cada semana', () => {
		const stages = {
			...NONE,
			altas: [
				{ date: '2026-10-19', count: 2 },
				{ date: '2026-10-21', count: 1 },
				{ date: '2026-10-26', count: 4 }
			]
		};

		const semanal = funnelByWeek(stages, 'semanal');
		const acumulado = funnelByWeek(stages, 'acumulado');

		expect(semanal.map((row) => [row.week, row.counts.altas])).toEqual([
			['2026-10-19', 3],
			['2026-10-26', 4]
		]);
		expect(acumulado.map((row) => [row.week, row.counts.altas])).toEqual([
			['2026-10-19', 3],
			['2026-10-26', 7]
		]);
	});

	it('una etapa sin datos es nula en todas las semanas, no cero', () => {
		const stages = { ...NONE, altas: [{ date: '2026-10-19', count: 1 }] };

		const [week] = funnelByWeek(stages, 'semanal');

		expect(week?.counts.descargas).toBeNull();
		expect(week?.counts.altas).toBe(1);
	});

	it('sin ninguna fecha no hay semanas', () => {
		expect(funnelByWeek(NONE, 'acumulado')).toEqual([]);
	});
});
