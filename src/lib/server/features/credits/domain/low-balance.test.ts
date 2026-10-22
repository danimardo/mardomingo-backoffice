// Aviso de saldo bajo (BE-FR-49.7, US5 escenario 4; T253). Puro: el saldo, el umbral y el estado guardado llegan por parámetro.
// Avisa una sola vez al cruzar hacia abajo; se rearma al superar el umbral; un umbral nulo lo desactiva; con umbral 0 la deuda
// (saldo negativo) cruza el umbral.
import { describe, expect, it } from 'vitest';
import { lowBalanceVerdict } from './low-balance';

const THRESHOLD = 5_000_000;

describe('lowBalanceVerdict', () => {
	it('al cruzar hacia abajo con el aviso sin enviar, avisa una vez y lo marca', () => {
		expect(
			lowBalanceVerdict({ balanceMicro: 4_000_000, thresholdMicro: THRESHOLD, notified: false })
		).toEqual({
			event: 'notified',
			notified: true
		});
	});

	it('si sigue por debajo y ya avisó, no hace nada', () => {
		expect(
			lowBalanceVerdict({ balanceMicro: 1_000_000, thresholdMicro: THRESHOLD, notified: true })
		).toEqual({
			event: null,
			notified: true
		});
	});

	it('al superar el umbral con el aviso marcado, se rearma', () => {
		expect(
			lowBalanceVerdict({ balanceMicro: 9_000_000, thresholdMicro: THRESHOLD, notified: true })
		).toEqual({
			event: 'rearmed',
			notified: false
		});
	});

	it('un umbral nulo desactiva el aviso: no avisa ni rearma', () => {
		expect(lowBalanceVerdict({ balanceMicro: 0, thresholdMicro: null, notified: false })).toEqual({
			event: null,
			notified: false
		});
		expect(lowBalanceVerdict({ balanceMicro: 0, thresholdMicro: null, notified: true })).toEqual({
			event: null,
			notified: true
		});
	});

	it('con umbral 0, la deuda (saldo negativo) cruza el umbral y avisa', () => {
		expect(lowBalanceVerdict({ balanceMicro: -1, thresholdMicro: 0, notified: false })).toEqual({
			event: 'notified',
			notified: true
		});
		expect(lowBalanceVerdict({ balanceMicro: 0, thresholdMicro: 0, notified: true })).toEqual({
			event: 'rearmed',
			notified: false
		});
	});
});

describe('aviso de saldo bajo: fronteras (T253, mutación)', () => {
	it('un saldo exactamente igual al umbral no está por debajo: no avisa', () => {
		expect(lowBalanceVerdict({ balanceMicro: 500, thresholdMicro: 500, notified: false })).toEqual({
			event: null,
			notified: false
		});
	});

	it('un saldo exactamente igual al umbral con el aviso ya enviado se rearma', () => {
		expect(lowBalanceVerdict({ balanceMicro: 500, thresholdMicro: 500, notified: true })).toEqual({
			event: 'rearmed',
			notified: false
		});
	});

	it('un umbral nulo conserva el estado de aviso que ya tenía', () => {
		expect(lowBalanceVerdict({ balanceMicro: -1, thresholdMicro: null, notified: true })).toEqual({
			event: null,
			notified: true
		});
	});
});
