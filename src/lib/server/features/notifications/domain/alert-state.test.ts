// Estado de las alertas al administrador (Historias 5.13; SC-019; T150): una alerta se envía al cruzar la condición, no se
// repite mientras la condición siga, se rearma al normalizarse y vuelve a enviarse en el siguiente cruce.
import { describe, expect, it } from 'vitest';
import { alertKeys, decideClear, decideRaise, type AlertRecord } from './alert-state';

const NOW = 1_000_000;

describe('decideRaise', () => {
	it('el primer cruce envía la alerta y la deja activa', () => {
		const decision = decideRaise(undefined, NOW);

		expect(decision).toEqual({
			action: 'send',
			next: { active: true, lastSentAt: NOW }
		});
	});

	it('una condición repetida con la alerta activa se suprime y no envía nada', () => {
		const current: AlertRecord = { active: true, lastSentAt: NOW - 5_000 };

		expect(decideRaise(current, NOW)).toEqual({ action: 'suppress', next: current });
	});

	it('un nuevo cruce después de rearmar vuelve a enviar', () => {
		const rearmed: AlertRecord = { active: false, lastSentAt: NOW - 5_000 };

		expect(decideRaise(rearmed, NOW)).toEqual({
			action: 'send',
			next: { active: true, lastSentAt: NOW }
		});
	});
});

describe('decideClear', () => {
	it('una condición normalizada con la alerta activa la rearma, sin enviar nada', () => {
		const current: AlertRecord = { active: true, lastSentAt: NOW - 5_000 };

		expect(decideClear(current)).toEqual({
			action: 'rearm',
			next: { active: false, lastSentAt: NOW - 5_000 }
		});
	});

	it('normalizar algo que no estaba activo no hace nada', () => {
		expect(decideClear(undefined)).toEqual({ action: 'none', next: undefined });
		expect(decideClear({ active: false, lastSentAt: null })).toEqual({
			action: 'none',
			next: { active: false, lastSentAt: null }
		});
	});
});

describe('claves de alerta tipadas', () => {
	it('cada tipo de alerta tiene su clave, sin ambigüedad', () => {
		expect(alertKeys.fxStale()).toBe('fx_stale');
		expect(alertKeys.modelRetired('openai/gpt-5.6-luna')).toBe('model:openai/gpt-5.6-luna:retired');
		expect(alertKeys.modelPrice('openai/gpt-5.6-luna')).toBe('model:openai/gpt-5.6-luna:price');
		expect(alertKeys.flagged('usr_1', '2026-10-11')).toBe('flagged:usr_1:2026-10-11');
	});
});
