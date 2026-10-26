// Plazos de retención (BE-FR-83; data-model §6; T292) con cortes en Europe/Madrid, también en los cambios de hora.
import { describe, expect, it } from 'vitest';
import { civilDateOf, DAY_MS, madridMidnight } from '$lib/shared/dates';
import { toCivilDate, toEpochMs } from '$lib/shared/time';
import { addMonths, retentionCutoffs } from './retention';

describe('addMonths', () => {
	it('resta y suma meses de calendario', () => {
		expect(addMonths(toCivilDate('2026-10-19'), -24)).toBe('2024-10-19');
		expect(addMonths(toCivilDate('2026-01-15'), -1)).toBe('2025-12-15');
		expect(addMonths(toCivilDate('2026-10-19'), 36)).toBe('2029-10-19');
	});

	it('si el día no existe en el mes de destino, se queda en el último día de ese mes', () => {
		expect(addMonths(toCivilDate('2026-03-31'), -1)).toBe('2026-02-28');
		expect(addMonths(toCivilDate('2028-02-29'), -12)).toBe('2027-02-28');
		expect(addMonths(toCivilDate('2028-02-29'), -48)).toBe('2024-02-29');
	});
});

describe('retentionCutoffs', () => {
	const NOW = toEpochMs(Date.UTC(2026, 9, 19, 9, 30, 0));

	it('[BE-FR-04/CA6] sesiones: 30 días después de caducar', () => {
		expect(retentionCutoffs(NOW).sessionsExpiredBefore).toBe(NOW - 30 * DAY_MS);
	});

	it('contadores de login y de límites: más de 24 horas', () => {
		expect(retentionCutoffs(NOW).attemptsBefore).toBe(NOW - DAY_MS);
	});

	it('tokens de verificación: los ya caducados', () => {
		expect(retentionCutoffs(NOW).verificationsExpiredBefore).toBe(NOW);
	});

	it('claves de alerta con usuario o fecha: más de 30 días', () => {
		expect(retentionCutoffs(NOW).alertsBefore).toBe(NOW - 30 * DAY_MS);
	});

	it('operaciones y reservas liberadas: a las 00:00 de Madrid del día de hace 24 meses', () => {
		const cutoffs = retentionCutoffs(NOW);

		expect(cutoffs.operationsBefore).toBe(madridMidnight(toCivilDate('2024-10-19')));
		expect(cutoffs.holdsReleasedBefore).toBe(cutoffs.operationsBefore);
	});

	it('el corte de 24 meses cambia con el día de Madrid, no con el de UTC', () => {
		// 2026-10-18 22:30 UTC ya es 2026-10-19 00:30 en Madrid (UTC+2): el día civil es el 19.
		const lateUtc = toEpochMs(Date.UTC(2026, 9, 18, 22, 30, 0));
		expect(civilDateOf(lateUtc)).toBe('2026-10-19');
		expect(retentionCutoffs(lateUtc).operationsBefore).toBe(
			madridMidnight(toCivilDate('2024-10-19'))
		);

		// 2026-10-18 21:30 UTC son las 23:30 del 18 en Madrid: el corte es el del día anterior.
		const earlyUtc = toEpochMs(Date.UTC(2026, 9, 18, 21, 30, 0));
		expect(retentionCutoffs(earlyUtc).operationsBefore).toBe(
			madridMidnight(toCivilDate('2024-10-18'))
		);
	});

	it('el cambio de hora de octubre no desplaza el corte de medianoche', () => {
		// 2026-10-25 es el día de 25 horas: el corte de 24 meses atrás cae en un día de verano (UTC+2).
		const changeDay = toEpochMs(Date.UTC(2026, 9, 25, 12, 0, 0));
		expect(retentionCutoffs(changeDay).operationsBefore).toBe(
			madridMidnight(toCivilDate('2024-10-25'))
		);
	});
});
