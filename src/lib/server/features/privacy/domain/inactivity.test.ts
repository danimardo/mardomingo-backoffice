// Cuentas inactivas (BE-FR-86; T295): qué hacer con cada cuenta según su actividad, su aviso y sus compras. Una cuenta con
// compra real no se selecciona nunca (CA1), y cualquier actividad durante el aviso cancela el borrado (CA2).
import { describe, expect, it } from 'vitest';
import { madridMidnight } from '$lib/shared/dates';
import { toCivilDate, toEpochMs } from '$lib/shared/time';
import { decideInactivity, type InactivityAccount } from './inactivity';

const CONFIG = { years: 3, noticeDays: 30 } as const;
const DAY = 86_400_000;
const NOW = toEpochMs(Date.UTC(2026, 9, 19, 9, 0, 0));

function account(overrides: Partial<InactivityAccount> = {}): InactivityAccount {
	return { referenceAt: NOW - 4 * 365 * DAY, warnedAt: null, hasRealPurchase: false, ...overrides };
}

describe('decideInactivity', () => {
	it('sin actividad durante los años de plazo, avisa', () => {
		expect(decideInactivity(account(), NOW, CONFIG)).toBe('warn');
	});

	it('con actividad más reciente que el plazo, no hace nada', () => {
		expect(decideInactivity(account({ referenceAt: NOW - 2 * 365 * DAY }), NOW, CONFIG)).toBe(
			'none'
		);
	});

	it('el plazo se cuenta en años de calendario desde el día de la última actividad, en Madrid', () => {
		const reference = madridMidnight(toCivilDate('2023-10-19')) + 3_600_000;
		// El 18 de octubre de 2026 aún no han pasado tres años; el 19 sí.
		const dayBefore = toEpochMs(madridMidnight(toCivilDate('2026-10-18')) + 12 * 3_600_000);
		const sameDay = madridMidnight(toCivilDate('2026-10-19'));
		expect(decideInactivity(account({ referenceAt: reference }), dayBefore, CONFIG)).toBe('none');
		expect(decideInactivity(account({ referenceAt: reference }), sameDay, CONFIG)).toBe('warn');
	});

	it('una cuenta con compra real nunca se selecciona, aunque lleve años sin actividad o ya esté avisada', () => {
		expect(decideInactivity(account({ hasRealPurchase: true }), NOW, CONFIG)).toBe('none');
		expect(
			decideInactivity(account({ hasRealPurchase: true, warnedAt: NOW - 90 * DAY }), NOW, CONFIG)
		).toBe('none');
	});

	it('avisada hace menos de 30 días y sin actividad: espera', () => {
		expect(decideInactivity(account({ warnedAt: NOW - 29 * DAY }), NOW, CONFIG)).toBe('none');
	});

	it('avisada hace 30 días o más y sin actividad: borra', () => {
		expect(decideInactivity(account({ warnedAt: NOW - 30 * DAY }), NOW, CONFIG)).toBe('delete');
		expect(decideInactivity(account({ warnedAt: NOW - 200 * DAY }), NOW, CONFIG)).toBe('delete');
	});

	it('actividad después del aviso: cancela el borrado, aunque el plazo ya haya vencido', () => {
		const warnedAt = NOW - 31 * DAY;
		expect(decideInactivity(account({ warnedAt, referenceAt: warnedAt + 1 }), NOW, CONFIG)).toBe(
			'cancel'
		);
		expect(decideInactivity(account({ warnedAt, referenceAt: NOW - DAY }), NOW, CONFIG)).toBe(
			'cancel'
		);
	});

	it('la actividad anterior al aviso no lo cancela', () => {
		const warnedAt = NOW - 10 * DAY;
		expect(decideInactivity(account({ warnedAt, referenceAt: warnedAt - 1 }), NOW, CONFIG)).toBe(
			'none'
		);
	});
});
