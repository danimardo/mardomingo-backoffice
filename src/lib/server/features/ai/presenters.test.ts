// Forma de la fila de consumo de W24 (T258; BE-FR-49.4): exacta, con el nombre de la app y de la operación, y sin modelo, coste
// real ni id interno.
import { describe, expect, it } from 'vitest';
import { toEpochMs } from '$lib/shared/time';
import { consumptionRowDto } from './presenters';

describe('consumptionRowDto', () => {
	it('muestra fecha, app, operación con su nombre, estado y créditos, y nada más', () => {
		const dto = consumptionRowDto(
			{
				createdAt: toEpochMs(Date.UTC(2026, 9, 12, 10, 0, 0)),
				status: 'completed',
				chargedMicro: 776_480
			},
			{ appName: 'Secretario AI', operationName: 'Resumen de reunión' }
		);

		expect(dto).toStrictEqual({
			date: '2026-10-12',
			appName: 'Secretario AI',
			operation: 'Resumen de reunión',
			status: 'completed',
			credits: 0.77648
		});
	});

	it('si falta un nombre del catálogo deja el campo vacío, nunca el id interno', () => {
		const dto = consumptionRowDto(
			{ createdAt: toEpochMs(Date.UTC(2026, 9, 12, 10, 0, 0)), status: 'failed', chargedMicro: 0 },
			{ appName: undefined, operationName: undefined }
		);

		expect(dto).toStrictEqual({
			date: '2026-10-12',
			appName: '',
			operation: '',
			status: 'failed',
			credits: 0
		});
	});
});
