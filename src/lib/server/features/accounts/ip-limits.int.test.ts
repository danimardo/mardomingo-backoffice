// Límites de autenticación por IP contra SQLite real (BE-FR-45, D-02; T204): login, reenvío de verificación y recuperación.
// Al superar el máximo de la ventana, `RATE_LIMITED` con `Retry-After`; el evento no lleva la IP. El reloj de la fixture
// es fijo, así que el reinicio de ventana se prueba envejeciendo `window_start` en la base.
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import {
	EMAIL,
	IP,
	PASSWORD,
	accountsFixture,
	codeOf,
	type AccountsFixture
} from '../../../../../tests/builders/accounts';
import { toEpochMs } from '$lib/shared/time';
import type { AuthRateScope } from './repository';
import { authRateLimits } from './schema';

const OTHER_IP = '198.51.100.9';
const HOUR_S = 3600;

let fixture: AccountsFixture;

beforeEach(() => {
	fixture = accountsFixture();
});

afterEach(() => {
	fixture.close();
});

function loginFrom(ip: string | null, email: string) {
	return fixture.accounts.login({ email, password: PASSWORD, redirectTo: undefined, remoteIp: ip });
}

function resendFrom(ip: string | null) {
	return fixture.accounts.resendVerification({ email: EMAIL, remoteIp: ip });
}

function resetFrom(ip: string | null) {
	return fixture.accounts.requestPasswordReset({ email: EMAIL, remoteIp: ip });
}

/** Envejece la ventana de un ámbito e IP: el siguiente recuento empieza de cero, como si el reloj hubiese avanzado. */
function ageWindow(scope: AuthRateScope, ip: string, hours: number): void {
	const past = toEpochMs(Date.now() - hours * 60 * 60 * 1000);
	fixture.database.db
		.update(authRateLimits)
		.set({ windowStart: past })
		.where(and(eq(authRateLimits.scope, scope), eq(authRateLimits.ip, ip)))
		.run();
}

describe('login por IP (BE-FR-45)', () => {
	it('superado el máximo de la ventana de 15 minutos responde RATE_LIMITED con Retry-After', async () => {
		for (let index = 0; index < 30; index += 1) {
			await expect(loginFrom(IP, `persona${String(index)}@ejemplo.es`)).rejects.toMatchObject({
				code: 'INVALID_CREDENTIALS'
			});
		}

		expect(await codeOf(() => loginFrom(IP, 'otra@ejemplo.es'))).toBe('RATE_LIMITED');
		const limited = await loginFrom(IP, 'otra@ejemplo.es').catch((error: unknown) => error);
		expect(limited).toMatchObject({ code: 'RATE_LIMITED', details: { retryAfterSeconds: 900 } });
		expect(eventsNamed(fixture.logger, 'accounts.rate_limit.exceeded').at(-1)?.fields).toEqual({
			reason: 'login'
		});
	});

	it('otra IP tiene su propio contador', async () => {
		for (let index = 0; index < 30; index += 1) {
			await loginFrom(IP, `persona${String(index)}@ejemplo.es`).catch(() => undefined);
		}

		expect(await codeOf(() => loginFrom(OTHER_IP, 'otra@ejemplo.es'))).toBe('INVALID_CREDENTIALS');
	});

	it('sin IP conocida no se aplica el límite', async () => {
		for (let index = 0; index < 31; index += 1) {
			await loginFrom(null, `persona${String(index)}@ejemplo.es`).catch(() => undefined);
		}

		expect(await codeOf(() => loginFrom(null, 'otra@ejemplo.es'))).toBe('INVALID_CREDENTIALS');
	});

	it('una ventana vencida se reinicia', async () => {
		for (let index = 0; index < 31; index += 1) {
			await loginFrom(IP, `persona${String(index)}@ejemplo.es`).catch(() => undefined);
		}
		ageWindow('login', IP, 1);

		expect(await codeOf(() => loginFrom(IP, 'otra@ejemplo.es'))).toBe('INVALID_CREDENTIALS');
	});
});

describe('reenvío de verificación por IP (BE-FR-45)', () => {
	it('el sexto reenvío en la hora responde RATE_LIMITED con Retry-After de una hora', async () => {
		for (let index = 0; index < 5; index += 1) {
			await resendFrom(IP);
		}

		const limited = await resendFrom(IP).catch((error: unknown) => error);
		expect(limited).toMatchObject({ code: 'RATE_LIMITED', details: { retryAfterSeconds: HOUR_S } });
		expect(eventsNamed(fixture.logger, 'accounts.rate_limit.exceeded').at(-1)?.fields).toEqual({
			reason: 'resend_verification'
		});
	});

	it('el evento de límite no lleva la IP', async () => {
		for (let index = 0; index < 6; index += 1) {
			await resendFrom(IP).catch(() => undefined);
		}

		const fields = JSON.stringify(eventsNamed(fixture.logger, 'accounts.rate_limit.exceeded'));
		expect(fields).not.toContain(IP);
	});
});

describe('recuperación de contraseña por IP (BE-FR-45)', () => {
	it('la sexta solicitud en la hora responde RATE_LIMITED; con la ventana vencida vuelve a pasar', async () => {
		for (let index = 0; index < 5; index += 1) {
			await resetFrom(IP);
		}
		expect(await codeOf(() => resetFrom(IP))).toBe('RATE_LIMITED');

		ageWindow('password_reset', IP, 2);

		expect(await codeOf(() => resetFrom(IP))).not.toBe('RATE_LIMITED');
	});
});
