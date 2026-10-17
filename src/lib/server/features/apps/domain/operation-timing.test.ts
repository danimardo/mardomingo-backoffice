// Tiempo máximo total de una operación para `/app/status` (BE-FR-77 CA4, FR-050; T193). Puro.
import { describe, expect, it } from 'vitest';
import { CHAT_RETRY_WAITS_MS, operationTotalMs } from './operation-timing';

describe('operationTotalMs', () => {
	it('chat: principal con un reintento a 2 s y un respaldo, con 45 s por intento', () => {
		// 2 intentos del principal (90 s) + 1 espera (2 s) + 1 respaldo (45 s) = 137 s.
		expect(
			operationTotalMs({
				primaryTimeoutMs: 45_000,
				retryWaitsMs: CHAT_RETRY_WAITS_MS,
				fallbackTimeoutsMs: [45_000]
			})
		).toBe(137_000);
	});

	it('transcripción: 4 intentos de Voxtral (2, 4 y 8 s de espera) más un respaldo de 60 s = 254 s', () => {
		expect(
			operationTotalMs({
				primaryTimeoutMs: 45_000,
				retryWaitsMs: [2_000, 4_000, 8_000],
				fallbackTimeoutsMs: [60_000]
			})
		).toBe(254_000);
	});

	it('sin respaldos, solo cuentan el principal y sus reintentos', () => {
		expect(
			operationTotalMs({ primaryTimeoutMs: 10_000, retryWaitsMs: [], fallbackTimeoutsMs: [] })
		).toBe(10_000);
	});
});
