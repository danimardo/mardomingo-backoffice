// Intentos de registro por IP (C-36; BE-FR-45): el límite de altas por IP solo cuenta las cuentas creadas, así que sin él cada
// intento fallido llama a Turnstile sin freno. `signup_attempts_per_ip_hour` cuenta todos los intentos por IP y hora y se
// comprueba antes del captcha: al superarlo, `RATE_LIMITED` (429 en W08) con el tiempo de espera, sin llamar a Turnstile.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	accountsFixture,
	codeOf,
	registration,
	type AccountsFixture
} from '../../../../../tests/builders/accounts';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import { AppError } from '$lib/server/shared/errors';

/** `signup_attempts_per_ip_hour` sembrado (apps/defaults.ts). */
const ATTEMPTS_PER_IP_HOUR = 10;
const HOUR_SECONDS = 60 * 60;

let fixture: AccountsFixture;

beforeEach(() => {
	fixture = accountsFixture();
	// Captcha inválido: ningún intento crea cuenta, así que el límite de altas creadas (3 en 24 h) no llega a saltar.
	fixture.captcha.outcome('invalid');
});

afterEach(() => {
	fixture.close();
});

async function attempt(remoteIp: string | null, index: number): Promise<unknown> {
	return fixture.accounts
		.register(registration({ email: `intento${String(index)}@ejemplo.es`, remoteIp }))
		.then(
			() => undefined,
			(error: unknown) => error
		);
}

describe('[C-36] intentos de registro por IP y hora', () => {
	it('superado el límite responde RATE_LIMITED con el tiempo de espera y no llama al captcha', async () => {
		for (let index = 0; index < ATTEMPTS_PER_IP_HOUR; index += 1) {
			expect(await attempt('203.0.113.7', index)).toMatchObject({ code: 'CAPTCHA_INVALID' });
		}
		expect(fixture.captcha.checks).toHaveLength(ATTEMPTS_PER_IP_HOUR);

		const error = await attempt('203.0.113.7', ATTEMPTS_PER_IP_HOUR);

		expect(error).toBeInstanceOf(AppError);
		expect(error).toMatchObject({ code: 'RATE_LIMITED', status: 429 });
		const seconds = error instanceof AppError ? error.details.retryAfterSeconds : undefined;
		expect(seconds).toBeGreaterThan(0);
		expect(seconds).toBeLessThanOrEqual(HOUR_SECONDS);
		expect(fixture.captcha.checks).toHaveLength(ATTEMPTS_PER_IP_HOUR);
		expect(
			eventsNamed(fixture.logger, 'accounts.rate_limit.exceeded').map((event) => event.fields)
		).toEqual([{ reason: 'signup' }]);
	}, 30_000);

	it('los intentos válidos también cuentan, y bloquean aunque el captcha fuese a pasar', async () => {
		fixture.captcha.outcome('valid');
		for (let index = 0; index < ATTEMPTS_PER_IP_HOUR; index += 1) {
			// Las tres primeras crean cuenta; las demás chocan con el límite de altas creadas, pero cuentan como intento.
			await attempt('203.0.113.8', index);
		}

		expect(
			await codeOf(() =>
				fixture.accounts.register(
					registration({ email: 'once@ejemplo.es', remoteIp: '203.0.113.8' })
				)
			)
		).toBe('RATE_LIMITED');
		expect(fixture.captcha.checks).toHaveLength(ATTEMPTS_PER_IP_HOUR);
	}, 30_000);

	it('las direcciones del mismo /64 comparten el contador; otra IP tiene el suyo (C-33)', async () => {
		for (let index = 0; index < ATTEMPTS_PER_IP_HOUR; index += 1) {
			await attempt(`2001:db8:abcd:12::${(index + 1).toString(16)}`, index);
		}

		expect(await attempt('2001:db8:abcd:12:ffff::1', ATTEMPTS_PER_IP_HOUR)).toMatchObject({
			code: 'RATE_LIMITED'
		});
		expect(await attempt('198.51.100.20', ATTEMPTS_PER_IP_HOUR + 1)).toMatchObject({
			code: 'CAPTCHA_INVALID'
		});
	}, 30_000);

	it('sin IP conocida no hay límite de intentos (como el de altas por IP)', async () => {
		for (let index = 0; index <= ATTEMPTS_PER_IP_HOUR; index += 1) {
			expect(await attempt(null, index)).toMatchObject({ code: 'CAPTCHA_INVALID' });
		}
	}, 30_000);
});
