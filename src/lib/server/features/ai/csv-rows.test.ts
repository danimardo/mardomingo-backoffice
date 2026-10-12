// Filas CSV del consumo del panel (BE-FR-49.6; T252): fecha, app, operación, estado y créditos cobrados. Puras: los hechos de
// la operación llegan por parámetro.
import { describe, expect, it } from 'vitest';
import { toEpochMs } from '$lib/shared/time';
import { consumptionRowsOf } from './csv-rows';

describe('consumptionRowsOf', () => {
	it('escribe fecha, app, operación, estado y créditos cobrados', () => {
		const rows = consumptionRowsOf([
			{
				createdAt: toEpochMs(Date.UTC(2026, 9, 11, 9, 0, 0)),
				appName: 'Secretario AI',
				operation: 'improve',
				status: 'ok',
				chargedMicro: 776_480
			}
		]);

		expect(rows).toEqual([['2026-10-11', 'Secretario AI', 'improve', 'ok', 0.77648]]);
	});

	it('sin operaciones no hay filas', () => {
		expect(consumptionRowsOf([])).toEqual([]);
	});
});
