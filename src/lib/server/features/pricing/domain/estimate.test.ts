// Estimación del coste máximo (BE-FR-72 CA1–CA3; T144). Es lo que se reserva antes de llamar al proveedor: se toma el
// precio más caro entre el modelo principal y sus respaldos, y una operación sin precio ni coste estimado no se activa.
import { describe, expect, it } from 'vitest';
import {
	canActivateOperation,
	checkMaxCost,
	estimateChatMicroUsd,
	estimateImageMicroUsd,
	estimateTranscriptionMicroUsd
} from './estimate';

// Precios por millón de tokens en µUSD (gpt-5-mini: 0,25 y 2 USD por millón).
const MINI = { inputPerMTokMicroUsd: 250_000, outputPerMTokMicroUsd: 2_000_000 };
// Un modelo más caro (2 y 10 USD por millón).
const PRO = { inputPerMTokMicroUsd: 2_000_000, outputPerMTokMicroUsd: 10_000_000 };

describe('estimateChatMicroUsd (BE-FR-72 CA1)', () => {
	it('usa el precio más caro entre el principal y los respaldos', () => {
		// 3.000 caracteres a 3 por token son 1.000 tokens; una imagen son 1.500 más; salida máxima de 4.096 tokens.
		const cost = estimateChatMicroUsd({
			charCount: 3_000,
			imageCount: 1,
			charsPerToken: 3,
			imageTokens: 1_500,
			maxOutputTokens: 4_096,
			models: [MINI, PRO]
		});

		// PRO: 2.500 × 2 USD/M + 4.096 × 10 USD/M = 5.000 + 40.960 = 45.960 µUSD.
		expect(cost).toBe(45_960);
	});

	it('con un solo modelo, lo que cuesta ese modelo, redondeado al µUSD superior', () => {
		const cost = estimateChatMicroUsd({
			charCount: 3_000,
			imageCount: 0,
			charsPerToken: 3,
			imageTokens: 1_500,
			maxOutputTokens: 4_096,
			models: [MINI]
		});

		// 1.000 × 0,25 + 4.096 × 2 = 250 + 8.192 = 8.442 µUSD.
		expect(cost).toBe(8_442);
	});

	it('sin modelos no hay estimación posible', () => {
		expect(() =>
			estimateChatMicroUsd({
				charCount: 1,
				imageCount: 0,
				charsPerToken: 3,
				imageTokens: 0,
				maxOutputTokens: 1,
				models: []
			})
		).toThrow();
	});
});

describe('estimateTranscriptionMicroUsd (BE-FR-72 CA1)', () => {
	it('duración medida × el precio por minuto más caro entre Voxtral y el respaldo', () => {
		// 310 s (300 s más la tolerancia de 10 s) a 0,006 USD/min (el respaldo) = 31.000 µUSD.
		expect(estimateTranscriptionMicroUsd({ seconds: 310, perMinuteMicroUsd: [3_000, 6_000] })).toBe(
			31_000
		);
	});
});

describe('orden de los precios no cambia el resultado (el más caro gana)', () => {
	it('el modelo más caro gana aunque vaya primero o último', () => {
		const base = {
			charCount: 3_000,
			imageCount: 0,
			charsPerToken: 3,
			imageTokens: 0,
			maxOutputTokens: 4_096
		};
		expect(estimateChatMicroUsd({ ...base, models: [PRO, MINI] })).toBe(42_960);
		expect(estimateChatMicroUsd({ ...base, models: [MINI, PRO] })).toBe(
			estimateChatMicroUsd({ ...base, models: [PRO, MINI] })
		);
		expect(estimateTranscriptionMicroUsd({ seconds: 310, perMinuteMicroUsd: [6_000, 3_000] })).toBe(
			31_000
		);
	});

	it('una transcripción sin precio por minuto no se puede estimar', () => {
		expect(() => estimateTranscriptionMicroUsd({ seconds: 310, perMinuteMicroUsd: [] })).toThrow();
	});
});

describe('estimateImageMicroUsd (BE-FR-72 CA1)', () => {
	it('el precio por imagen del modelo gana; si no se conoce, el coste máximo estimado de la operación', () => {
		expect(estimateImageMicroUsd({ perImageMicroUsd: 40_000, estimatedMaxMicroUsd: 80_000 })).toBe(
			40_000
		);
		expect(estimateImageMicroUsd({ perImageMicroUsd: null, estimatedMaxMicroUsd: 80_000 })).toBe(
			80_000
		);
		expect(
			estimateImageMicroUsd({ perImageMicroUsd: null, estimatedMaxMicroUsd: null })
		).toBeNull();
	});
});

describe('canActivateOperation (BE-FR-72 CA3)', () => {
	it('sin precio conocido ni coste máximo estimado, la operación no se puede activar', () => {
		expect(canActivateOperation({ hasModelPrice: false, hasEstimatedMaxCost: false })).toBe(false);
	});

	it('con uno de los dos, se puede activar', () => {
		expect(canActivateOperation({ hasModelPrice: true, hasEstimatedMaxCost: false })).toBe(true);
		expect(canActivateOperation({ hasModelPrice: false, hasEstimatedMaxCost: true })).toBe(true);
	});
});

describe('checkMaxCost (BE-FR-72 CA1)', () => {
	it('una estimación que supera el tope da el error con el estimado y el tope', () => {
		expect(checkMaxCost({ estimatedMicro: 2_000, maxMicro: 1_000 })).toEqual({
			ok: false,
			estimatedMicro: 2_000,
			maxMicro: 1_000
		});
	});

	it('igual o por debajo del tope, se permite', () => {
		expect(checkMaxCost({ estimatedMicro: 1_000, maxMicro: 1_000 })).toEqual({ ok: true });
		expect(checkMaxCost({ estimatedMicro: 500, maxMicro: 1_000 })).toEqual({ ok: true });
	});
});
