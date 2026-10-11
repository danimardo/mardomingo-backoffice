// Respaldos en orden dentro del tiempo total (BE-FR-77 CA4, BE-FR-80, FR-050, FR-057; T161).
import { describe, expect, it } from 'vitest';
import { planAttempts } from './fallback';

const totalMs = (attempts: readonly { timeoutMs: number; waitBeforeMs: number }[]): number =>
	attempts.reduce((sum, attempt) => sum + attempt.timeoutMs + attempt.waitBeforeMs, 0);

const TRANSCRIPTION = {
	primary: 'voxtral',
	fallbacks: ['backup'],
	retries: 3,
	waitsMs: [2_000, 4_000, 8_000],
	attemptTimeoutMs: 45_000,
	fallbackTimeoutMs: 60_000
};

describe('planAttempts', () => {
	it('reintenta el principal y después prueba cada respaldo una vez, en orden', () => {
		const plan = planAttempts(TRANSCRIPTION);

		expect(plan.map((attempt) => attempt.model)).toEqual([
			'voxtral',
			'voxtral',
			'voxtral',
			'voxtral',
			'backup'
		]);
		expect(plan.map((attempt) => attempt.waitBeforeMs)).toEqual([0, 2_000, 4_000, 8_000, 0]);
		expect(plan.at(-1)?.isFallback).toBe(true);
	});

	it('el tiempo máximo total es intentos + esperas + respaldos (4 × 45 s + 14 s + 60 s = 254 s)', () => {
		expect(totalMs(planAttempts(TRANSCRIPTION))).toBe(254_000);
	});

	it('sin respaldos solo hay intentos del principal', () => {
		const plan = planAttempts({ ...TRANSCRIPTION, fallbacks: [] });
		expect(plan).toHaveLength(4);
		expect(plan.every((attempt) => !attempt.isFallback)).toBe(true);
	});

	it('si hay más reintentos que esperas, se repite la última espera', () => {
		const plan = planAttempts({ ...TRANSCRIPTION, retries: 4, fallbacks: [] });
		expect(plan.map((attempt) => attempt.waitBeforeMs)).toEqual([0, 2_000, 4_000, 8_000, 8_000]);
	});
});

describe('sin esperas configuradas', () => {
	it('los reintentos no esperan si la lista de esperas está vacía', () => {
		const plan = planAttempts({ ...TRANSCRIPTION, waitsMs: [], retries: 2, fallbacks: [] });
		expect(plan.map((attempt) => attempt.waitBeforeMs)).toEqual([0, 0, 0]);
	});
});
