// Tope diario de cuentas sin compra real (FR-022, BE-FR-11.6, BE-FR-11 CA2; T198). Puro: el coste del día, las reservas
// activas y la nueva reserva llegan por parámetro.
import { describe, expect, it } from 'vitest';
import { dailyCapVerdict } from './daily-cap';

const CAP = 400_000_000;

describe('dailyCapVerdict', () => {
	it('una cuenta sin compra real puede reservar mientras cobros, reservas y la nueva no superen el tope', () => {
		expect(
			dailyCapVerdict({
				costsTodayMicro: 100_000_000,
				activeHoldsMicro: 100_000_000,
				newHoldMicro: 100_000_000,
				capMicro: CAP,
				hasRealPurchase: false
			})
		).toEqual({ ok: true });
	});

	it('superar el tope con la nueva reserva responde daily_free_limit', () => {
		expect(
			dailyCapVerdict({
				costsTodayMicro: 300_000_000,
				activeHoldsMicro: 50_000_000,
				newHoldMicro: 60_000_000,
				capMicro: CAP,
				hasRealPurchase: false
			})
		).toEqual({ ok: false, reason: 'daily_free_limit' });
	});

	it('llegar exactamente al tope pasa; pasarlo en 1 µc no', () => {
		expect(
			dailyCapVerdict({
				costsTodayMicro: 300_000_000,
				activeHoldsMicro: 0,
				newHoldMicro: 100_000_000,
				capMicro: CAP,
				hasRealPurchase: false
			})
		).toEqual({ ok: true });
		expect(
			dailyCapVerdict({
				costsTodayMicro: 300_000_001,
				activeHoldsMicro: 0,
				newHoldMicro: 100_000_000,
				capMicro: CAP,
				hasRealPurchase: false
			})
		).toEqual({ ok: false, reason: 'daily_free_limit' });
	});

	it('una cuenta con compra real queda exenta del tope', () => {
		expect(
			dailyCapVerdict({
				costsTodayMicro: 900_000_000,
				activeHoldsMicro: 0,
				newHoldMicro: 900_000_000,
				capMicro: CAP,
				hasRealPurchase: true
			})
		).toEqual({ ok: true });
	});
});
