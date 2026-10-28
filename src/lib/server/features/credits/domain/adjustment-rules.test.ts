// Reglas de los ajustes manuales del administrador (propuesta R04, R05, R07 y R06; decisiones D04, D13, D12 y D05). Funciones puras.
import { describe, expect, it } from 'vitest';
import {
	adjustmentCreditsFit,
	blockedAdjustmentAllowed,
	debitFitsKind,
	eurCentsOfCredits,
	freeExpiryOf,
	MAX_ADJUSTMENT_CREDITS,
	MAX_ADJUSTMENT_EXPIRY_DAYS
} from './adjustment-rules';

// 28 de octubre de 2026 a las 12:00 en Madrid (horario de verano, UTC+2).
const NOW = Date.UTC(2026, 9, 28, 10, 0, 0);
const CREDIT_MICRO = 1_000_000;

describe('tope por ajuste (R04, D04)', () => {
	it('el tope vale 100 000 créditos', () => {
		expect(MAX_ADJUSTMENT_CREDITS).toBe(100_000);
	});

	it('acepta exactamente el tope y rechaza un crédito por encima', () => {
		expect(adjustmentCreditsFit(100_000)).toBe(true);
		expect(adjustmentCreditsFit(100_001)).toBe(false);
	});

	it('acepta 1 crédito y rechaza 0, negativos, decimales y no numéricos', () => {
		expect(adjustmentCreditsFit(1)).toBe(true);
		expect(adjustmentCreditsFit(0)).toBe(false);
		expect(adjustmentCreditsFit(-1)).toBe(false);
		expect(adjustmentCreditsFit(1.5)).toBe(false);
		expect(adjustmentCreditsFit(Number.NaN)).toBe(false);
	});
});

describe('equivalente en euros de la vista previa (R04, D04)', () => {
	it('el tope equivale a 100 € con 1000 créditos por euro', () => {
		expect(eurCentsOfCredits(100_000, 1000)).toBe(10_000);
	});

	it('redondea al céntimo más cercano', () => {
		expect(eurCentsOfCredits(1500, 1000)).toBe(150);
		expect(eurCentsOfCredits(1, 1000)).toBe(0);
		expect(eurCentsOfCredits(3, 1000)).toBe(0);
		expect(eurCentsOfCredits(5, 1000)).toBe(1);
	});
});

describe('caducidad de la bolsa gratuita del ajuste (R05, D13)', () => {
	it('el horizonte máximo son 365 días', () => {
		expect(MAX_ADJUSTMENT_EXPIRY_DAYS).toBe(365);
	});

	it('el día de hoy es válido y caduca a las 00:00 de Madrid del día siguiente', () => {
		// El horario de verano de 2026 acabó el 25 de octubre: el 28 Madrid es UTC+1. Expira 29 de octubre 00:00 Madrid = 28 de octubre 23:00 UTC.
		expect(freeExpiryOf('2026-10-28', NOW)).toEqual({
			ok: true,
			expiresAt: Date.UTC(2026, 9, 28, 23, 0, 0)
		});
	});

	it('usa el huso de Madrid en invierno (UTC+1)', () => {
		// 15 de diciembre de 2026: expira 16 de diciembre 00:00 Madrid = 15 de diciembre 23:00 UTC.
		expect(freeExpiryOf('2026-12-15', NOW)).toEqual({
			ok: true,
			expiresAt: Date.UTC(2026, 11, 15, 23, 0, 0)
		});
	});

	it('el día del cambio de hora a verano usa el huso correcto (no el fin de día UTC)', () => {
		// Domingo 28 de marzo de 2027: el 29 a las 00:00 Madrid ya es horario de verano (UTC+2).
		expect(freeExpiryOf('2027-03-28', Date.UTC(2027, 2, 1, 12, 0, 0))).toEqual({
			ok: true,
			expiresAt: Date.UTC(2027, 2, 28, 22, 0, 0)
		});
	});

	it('acepta exactamente hoy + 365 días y rechaza un día más', () => {
		expect(freeExpiryOf('2027-10-28', NOW)).toMatchObject({ ok: true });
		expect(freeExpiryOf('2027-10-29', NOW)).toEqual({ ok: false, reason: 'beyond_horizon' });
	});

	it('rechaza un día anterior a hoy (ya caducado)', () => {
		expect(freeExpiryOf('2026-10-27', NOW)).toEqual({ ok: false, reason: 'past' });
	});

	it('rechaza fechas con formato o calendario inválido', () => {
		expect(freeExpiryOf('2026-02-30', NOW)).toEqual({ ok: false, reason: 'invalid' });
		expect(freeExpiryOf('2026-13-01', NOW)).toEqual({ ok: false, reason: 'invalid' });
		expect(freeExpiryOf('28/10/2026', NOW)).toEqual({ ok: false, reason: 'invalid' });
		expect(freeExpiryOf('', NOW)).toEqual({ ok: false, reason: 'invalid' });
	});
});

describe('cuentas bloqueadas (R07, D12)', () => {
	it('bloqueada: se rechaza la suma', () => {
		expect(blockedAdjustmentAllowed('credit', true)).toBe(false);
	});

	it('bloqueada: se permite la resta', () => {
		expect(blockedAdjustmentAllowed('debit', true)).toBe(true);
	});

	it('no bloqueada: se permiten sumas y restas', () => {
		expect(blockedAdjustmentAllowed('credit', false)).toBe(true);
		expect(blockedAdjustmentAllowed('debit', false)).toBe(true);
	});
});

describe('resta limitada al tipo de bolsa (R06, D05)', () => {
	it('exactamente el disponible del tipo cabe; un micro-crédito por encima no', () => {
		const adjustableMicro = 300 * CREDIT_MICRO;
		expect(debitFitsKind(adjustableMicro, adjustableMicro)).toBe(true);
		expect(debitFitsKind(adjustableMicro + 1, adjustableMicro)).toBe(false);
	});

	it('un tipo sin saldo no admite ninguna resta', () => {
		expect(debitFitsKind(1, 0)).toBe(false);
	});
});
