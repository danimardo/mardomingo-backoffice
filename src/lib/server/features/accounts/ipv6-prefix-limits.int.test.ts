// Límites por IP con IPv6 (C-33; BE-FR-45, BE-FR-11.4): quien tiene un /64 (lo habitual en una conexión IPv6) dispone de 2^64
// direcciones, así que todos los límites por IP de `accounts` las agrupan por /64, como el `ipv6Subnet` de Better Auth. Una
// IPv4 cuenta por sí misma, y una IPv4 mapeada en IPv6 (`::ffff:a.b.c.d`) cuenta como esa IPv4.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	EMAIL,
	PASSWORD,
	accountsFixture,
	codeOf,
	registration,
	type AccountsFixture
} from '../../../../../tests/builders/accounts';
import { user } from './schema';

/** `login_per_ip_15min`, `registrations_per_ip_24h` y los límites por IP y hora sembrados (apps/defaults.ts). */
const LOGINS_PER_IP = 30;
const SIGNUPS_PER_IP = 3;
const PER_IP_HOUR = 5;

let fixture: AccountsFixture;

beforeEach(() => {
	fixture = accountsFixture();
});

afterEach(() => {
	fixture.close();
});

/** Dirección `index` dentro del mismo /64, escrita de formas distintas (comprimida, con ceros a la izquierda y en mayúsculas). */
function sameSlash64(index: number): string {
	const host = (index + 1).toString(16);
	const forms = [
		`2001:db8:abcd:12::${host}`,
		`2001:0DB8:ABCD:0012:0:0:0:${host}`,
		`2001:db8:abcd:12:0::${host}`
	];
	return forms[index % forms.length] ?? '';
}

describe('[C-33] límites por IP con IPv6 agrupados por /64', () => {
	it('los logins desde direcciones del mismo /64 comparten el contador', async () => {
		for (let index = 0; index < LOGINS_PER_IP; index += 1) {
			await expect(
				fixture.accounts.login({
					email: `persona${String(index)}@ejemplo.es`,
					password: PASSWORD,
					redirectTo: undefined,
					remoteIp: sameSlash64(index)
				})
			).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
		}

		expect(
			await codeOf(() =>
				fixture.accounts.login({
					email: 'otra@ejemplo.es',
					password: PASSWORD,
					redirectTo: undefined,
					remoteIp: sameSlash64(LOGINS_PER_IP)
				})
			)
		).toBe('RATE_LIMITED');
	});

	it('las altas desde direcciones del mismo /64 comparten el límite de altas por IP', async () => {
		for (let index = 0; index < SIGNUPS_PER_IP; index += 1) {
			await fixture.accounts.register(
				registration({ email: `alta${String(index)}@ejemplo.es`, remoteIp: sameSlash64(index) })
			);
		}

		expect(
			await codeOf(() =>
				fixture.accounts.register(
					registration({ email: 'cuarta@ejemplo.es', remoteIp: sameSlash64(SIGNUPS_PER_IP) })
				)
			)
		).toBe('REGISTRATION_IP_LIMIT');
	});

	it('el reenvío y la recuperación desde el mismo /64 comparten su límite por IP', async () => {
		for (let index = 0; index < PER_IP_HOUR; index += 1) {
			await fixture.accounts.resendVerification({
				email: `reenvio${String(index)}@ejemplo.es`,
				remoteIp: sameSlash64(index)
			});
			await fixture.accounts.requestPasswordReset({
				email: `recupera${String(index)}@ejemplo.es`,
				remoteIp: sameSlash64(index)
			});
		}

		expect(
			await codeOf(() =>
				fixture.accounts.resendVerification({ email: EMAIL, remoteIp: sameSlash64(PER_IP_HOUR) })
			)
		).toBe('RATE_LIMITED');
		expect(
			await codeOf(() =>
				fixture.accounts.requestPasswordReset({ email: EMAIL, remoteIp: sameSlash64(PER_IP_HOUR) })
			)
		).toBe('RATE_LIMITED');
	});

	it('una IPv4 mapeada en IPv6 cuenta como esa IPv4, y otro /64 tiene su propio límite', async () => {
		for (let index = 0; index < SIGNUPS_PER_IP; index += 1) {
			await fixture.accounts.register(
				registration({
					email: `mapeada${String(index)}@ejemplo.es`,
					remoteIp: index === 0 ? '198.51.100.1' : '::ffff:198.51.100.1'
				})
			);
		}

		expect(
			await codeOf(() =>
				fixture.accounts.register(
					registration({ email: 'v4-cuarta@ejemplo.es', remoteIp: '198.51.100.1' })
				)
			)
		).toBe('REGISTRATION_IP_LIMIT');
		expect(
			await codeOf(() =>
				fixture.accounts.register(
					registration({ email: 'otro64@ejemplo.es', remoteIp: '2001:db8:abcd:13::1' })
				)
			)
		).toBe('sin error');
	});

	it('una dirección IPv4 sigue contando por sí misma', async () => {
		for (let index = 0; index < SIGNUPS_PER_IP; index += 1) {
			await fixture.accounts.register(
				registration({
					email: `v4-${String(index)}@ejemplo.es`,
					remoteIp: `198.51.100.${String(index + 1)}`
				})
			);
		}

		expect(
			await codeOf(() =>
				fixture.accounts.register(
					registration({ email: 'v4-otra@ejemplo.es', remoteIp: '198.51.100.99' })
				)
			)
		).toBe('sin error');
	});

	it('la IP del alta se guarda completa, en forma canónica (prueba del alta, BE-FR-83)', async () => {
		await fixture.accounts.register(registration({ remoteIp: '2001:DB8:abcd:12::7' }));

		const row = fixture.database.db
			.select({ ip: user.signupIp })
			.from(user)
			.where(eq(user.email, EMAIL))
			.get();
		expect(row?.ip).toBe('2001:0db8:abcd:0012:0000:0000:0000:0007');
	});
});
