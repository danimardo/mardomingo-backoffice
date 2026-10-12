// Freno global por coste de cuentas sin compra real (FR-072, BE-FR-46 CA1; T199). Puro: el coste del día, el estado
// guardado y el día civil de Madrid llegan por parámetro.
import { describe, expect, it } from 'vitest';
import { toCivilDate } from '$lib/shared/time';
import { brakeVerdict, eurCentsOf, type BrakeState } from './brake';

const TODAY = toCivilDate('2026-10-25');
const TOMORROW = toCivilDate('2026-10-26');
const LIMIT_CENTS = 500;

function stored(overrides: Partial<BrakeState> = {}): BrakeState {
	return {
		day: TODAY,
		active: false,
		activatedAt: null,
		releasedAt: null,
		releasedBy: null,
		...overrides
	};
}

describe('eurCentsOf', () => {
	it('convierte micro-USD a céntimos de euro con el tipo USD→EUR en ppm, redondeando hacia arriba', () => {
		// 1 USD (1.000.000 µUSD) con 0,92 EUR por USD = 92 céntimos.
		expect(eurCentsOf({ costMicroUsd: 1_000_000, fxUsdEurPpm: 920_000 })).toBe(92);
		// 1 µUSD con 0,92 = 0,000092 céntimos: se redondea a 1.
		expect(eurCentsOf({ costMicroUsd: 1, fxUsdEurPpm: 920_000 })).toBe(1);
	});
});

describe('brakeVerdict', () => {
	it('por encima del límite del día, el freno se activa', () => {
		expect(
			brakeVerdict({ freeCostCents: 501, limitCents: LIMIT_CENTS, stored: null, today: TODAY })
		).toEqual({
			active: true,
			trip: true
		});
	});

	it('en el límite exacto no se activa', () => {
		expect(
			brakeVerdict({ freeCostCents: 500, limitCents: LIMIT_CENTS, stored: null, today: TODAY })
		).toEqual({
			active: false,
			trip: false
		});
	});

	it('si ya está activo hoy, sigue activo sin volver a saltar', () => {
		expect(
			brakeVerdict({
				freeCostCents: 600,
				limitCents: LIMIT_CENTS,
				stored: stored({ active: true }),
				today: TODAY
			})
		).toEqual({ active: true, trip: false });
	});

	it('un día nuevo lo deja inactivo aunque siga marcado como activo', () => {
		expect(
			brakeVerdict({
				freeCostCents: 10,
				limitCents: LIMIT_CENTS,
				stored: stored({ active: true, day: TODAY }),
				today: TOMORROW
			})
		).toEqual({ active: false, trip: false });
	});

	it('una liberación manual no vuelve a activarlo ese mismo día aunque el coste siga alto', () => {
		expect(
			brakeVerdict({
				freeCostCents: 900,
				limitCents: LIMIT_CENTS,
				stored: stored({ active: false, releasedAt: 1_800_000_000_000, releasedBy: 'usr_admin' }),
				today: TODAY
			})
		).toEqual({ active: false, trip: false });
	});
});
