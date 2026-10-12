// Filas CSV de movimientos del panel (BE-FR-49.6; T252): fecha, tipo, créditos con coma decimal y app. Puras: los datos llegan
// por parámetro y la serialización reutiliza `shared/csv`.
import { describe, expect, it } from 'vitest';
import { toEpochMs } from '$lib/shared/time';
import { movementRowsOf } from './csv-rows';

describe('movementRowsOf', () => {
	it('escribe la fecha del día de Madrid, el tipo, los créditos con coma decimal y la app', () => {
		const rows = movementRowsOf([
			{
				createdAt: toEpochMs(Date.UTC(2026, 9, 11, 8, 0, 0)),
				type: 'purchase',
				amountMicro: 10_500_000_000,
				appName: null
			},
			{
				createdAt: toEpochMs(Date.UTC(2026, 9, 11, 9, 30, 0)),
				type: 'usage',
				amountMicro: -1_250_000,
				appName: 'Secretario AI'
			}
		]);

		expect(rows).toEqual([
			['2026-10-11', 'purchase', 10500, ''],
			['2026-10-11', 'usage', -1.25, 'Secretario AI']
		]);
	});

	it('sin movimientos no hay filas', () => {
		expect(movementRowsOf([])).toEqual([]);
	});
});
