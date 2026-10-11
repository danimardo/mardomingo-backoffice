// Reglas de la transcripción (E08; FR-032, FR-055, FR-070, BE-FR-35, BE-FR-44; T183). Puro: sin I/O, sin otras
// funcionalidades. Escenarios de proveedor, límite de duración, coste en µc a partir de los segundos del proveedor (o los
// medidos) y cobro solo de lo que facturó cada proveedor.
import { describe, expect, it } from 'vitest';
import {
	audioLimitOf,
	planTranscription,
	secondsToBill,
	transcriptionFailure,
	voxtralCostMicroUsd
} from './transcription';

describe('planTranscription: escenarios de proveedor', () => {
	it('solo principal, principal con respaldo y solo respaldo son válidos y mantienen el orden', () => {
		expect(planTranscription({ primaryEnabled: true, backupEnabled: false })).toEqual({
			ok: true,
			order: ['primary']
		});
		expect(planTranscription({ primaryEnabled: true, backupEnabled: true })).toEqual({
			ok: true,
			order: ['primary', 'backup']
		});
		expect(planTranscription({ primaryEnabled: false, backupEnabled: true })).toEqual({
			ok: true,
			order: ['backup']
		});
	});

	it('sin ningún proveedor activo la configuración no es válida', () => {
		expect(planTranscription({ primaryEnabled: false, backupEnabled: false })).toEqual({
			ok: false
		});
	});
});

describe('audioLimitOf: duración máxima con tolerancia', () => {
	it('acepta hasta el máximo más la tolerancia, inclusive', () => {
		expect(audioLimitOf({ durationSeconds: 120, maxSeconds: 60, toleranceSeconds: 60 })).toEqual({
			ok: true
		});
	});

	it('por encima del máximo más la tolerancia, indica el máximo para AUDIO_TOO_LONG', () => {
		expect(audioLimitOf({ durationSeconds: 120.5, maxSeconds: 60, toleranceSeconds: 60 })).toEqual({
			ok: false,
			maxSeconds: 60
		});
	});
});

describe('voxtralCostMicroUsd: segundos × precio por minuto / 60, redondeado hacia arriba', () => {
	it('30 s a 1.000.000 µUSD el minuto cuestan 500.000 µUSD', () => {
		expect(voxtralCostMicroUsd({ seconds: 30, pricePerMinuteMicroUsd: 1_000_000 })).toBe(500_000);
	});

	it('una fracción de micro-USD se redondea hacia arriba (1 s a 1.000.000 µUSD/min = 16.667)', () => {
		expect(voxtralCostMicroUsd({ seconds: 1, pricePerMinuteMicroUsd: 1_000_000 })).toBe(16_667);
	});

	it('sin segundos no hay coste', () => {
		expect(voxtralCostMicroUsd({ seconds: 0, pricePerMinuteMicroUsd: 1_000_000 })).toBe(0);
	});
});

describe('secondsToBill: segundos del proveedor, o los medidos si no los informa', () => {
	it('prefiere los segundos que factura el proveedor', () => {
		expect(secondsToBill({ providerSeconds: 12, measuredSeconds: 13.4 })).toBe(12);
	});

	it('si el proveedor no informa segundos, usa los medidos en el servidor', () => {
		expect(secondsToBill({ providerSeconds: null, measuredSeconds: 13.4 })).toBe(13.4);
	});
});

describe('transcriptionFailure: fallo de todos los proveedores, saneado', () => {
	it('un proveedor no configurado figura como null; los demás, con su motivo', () => {
		expect(transcriptionFailure('billing', 'not_configured')).toEqual({
			code: 'TRANSCRIPTION_FAILED',
			primaryError: 'billing',
			backupError: null
		});
		expect(transcriptionFailure('timeout', 'http')).toEqual({
			code: 'TRANSCRIPTION_FAILED',
			primaryError: 'timeout',
			backupError: 'http'
		});
	});
});

describe('transcriptionFailure: principal no configurado', () => {
	it('sin principal configurado, primaryError es null y el respaldo conserva su motivo', () => {
		expect(transcriptionFailure('not_configured', 'http')).toEqual({
			code: 'TRANSCRIPTION_FAILED',
			primaryError: null,
			backupError: 'http'
		});
	});
});
