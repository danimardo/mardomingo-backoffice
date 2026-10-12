// Límites de frecuencia y concurrencia (FR-069, BE-FR-43, BE-FR-63 CA4; T197). Puro: las marcas de tiempo llegan por
// parámetro. Ventana deslizante de un minuto; el límite de la cuenta suma todas sus apps, el de la app es menor o igual y
// solo cuenta sus peticiones; gana el primero alcanzado.
import { describe, expect, it } from 'vitest';
import { concurrencyVerdict, rateLimitVerdict, twoLevelRateVerdict } from './limits';

const MINUTE = 60_000;
const NOW = 1_800_000_000_000;

describe('rateLimitVerdict: ventana por minuto y Retry-After', () => {
	it('dentro del límite pasa', () => {
		expect(
			rateLimitVerdict({
				now: NOW,
				windowMs: MINUTE,
				limit: 3,
				timestamps: [NOW - 1_000, NOW - 2_000]
			})
		).toEqual({
			ok: true
		});
	});

	it('en el límite se bloquea y Retry-After es lo que falta para que salga la más antigua de la ventana', () => {
		// Tres peticiones en la ventana, la más antigua hace 20 s: se libera dentro de 40 s.
		expect(
			rateLimitVerdict({
				now: NOW,
				windowMs: MINUTE,
				limit: 3,
				timestamps: [NOW - 20_000, NOW - 10_000, NOW - 5_000]
			})
		).toEqual({ ok: false, retryAfterSeconds: 40 });
	});

	it('las peticiones fuera de la ventana no cuentan', () => {
		expect(
			rateLimitVerdict({
				now: NOW,
				windowMs: MINUTE,
				limit: 2,
				timestamps: [NOW - 61_000, NOW - 90_000, NOW - 1_000]
			})
		).toEqual({ ok: true });
	});

	it('Retry-After nunca es menor que 1 segundo', () => {
		expect(
			rateLimitVerdict({ now: NOW, windowMs: MINUTE, limit: 1, timestamps: [NOW - MINUTE + 100] })
		).toEqual({ ok: false, retryAfterSeconds: 1 });
	});
});

describe('twoLevelRateVerdict: cuenta (suma de apps) y app (≤ cuenta)', () => {
	const account = { limit: 3, timestamps: [NOW - 1_000, NOW - 2_000, NOW - 3_000] };

	it('gana el límite de la cuenta si se alcanza antes que el de la app', () => {
		const result = twoLevelRateVerdict({
			now: NOW,
			windowMs: MINUTE,
			account,
			app: { limit: 3, timestamps: [NOW - 1_000] }
		});
		expect(result).toEqual({ ok: false, reason: 'rate_limited_account', retryAfterSeconds: 57 });
	});

	it('el límite de la app solo cuenta sus peticiones y bloquea solo a esa app', () => {
		const result = twoLevelRateVerdict({
			now: NOW,
			windowMs: MINUTE,
			account: { limit: 10, timestamps: [NOW - 1_000] },
			app: { limit: 1, timestamps: [NOW - 1_000] }
		});
		expect(result).toEqual({ ok: false, reason: 'rate_limited_app', retryAfterSeconds: 59 });
	});

	it('sin límite de app (nulo), solo cuenta el de la cuenta', () => {
		expect(
			twoLevelRateVerdict({
				now: NOW,
				windowMs: MINUTE,
				account: { limit: 10, timestamps: [] },
				app: null
			})
		).toEqual({
			ok: true
		});
	});
});

describe('concurrencyVerdict: transcripciones en curso (cuenta y app)', () => {
	it('por debajo de ambos límites pasa', () => {
		expect(
			concurrencyVerdict({ accountInFlight: 1, appInFlight: 1, accountLimit: 2, appLimit: 2 })
		).toEqual({ ok: true });
	});

	it('en el límite de la cuenta se bloquea por cuenta', () => {
		expect(
			concurrencyVerdict({ accountInFlight: 2, appInFlight: 0, accountLimit: 2, appLimit: 5 })
		).toEqual({
			ok: false,
			reason: 'concurrency_account'
		});
	});

	it('en el límite de la app se bloquea por app', () => {
		expect(
			concurrencyVerdict({ accountInFlight: 0, appInFlight: 2, accountLimit: 5, appLimit: 2 })
		).toEqual({
			ok: false,
			reason: 'concurrency_app'
		});
	});
});
