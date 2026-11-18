// Antiabuso de las cuentas contra SQLite real (T095; BE-FR-01/CA4, BE-FR-11.2, BE-FR-11.4, BE-FR-67/CA1–CA2): dominios
// desechables, altas por IP, bloqueo por intentos y antienumeración. Los eventos no llevan email ni IP (15.19).
import { eq, notLike } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import {
	EMAIL,
	IP,
	PASSWORD,
	accountsFixture,
	codeOf,
	registration,
	verificationTokenFor,
	type AccountsFixture
} from '../../../../../tests/builders/accounts';
import { authRateLimits, loginAttempts, user } from './schema';

/** `login_max_failures` y `registrations_per_ip_24h` sembrados (apps/defaults.ts). */
const MAX_FAILURES = 10;
const SIGNUPS_PER_IP = 3;

let fixture: AccountsFixture;

beforeEach(() => {
	fixture = accountsFixture();
});

afterEach(() => {
	fixture.close();
});

/** Reservas de alta en curso (C-21): las filas de `auth_rate_limits` que no son el contador de intentos `attempt:` (C-36). */
function signupSlotRows() {
	return fixture.database.db
		.select()
		.from(authRateLimits)
		.where(notLike(authRateLimits.ip, 'attempt:%'))
		.all();
}

function login(email: string, password: string) {
	return { email, password, redirectTo: undefined, remoteIp: IP };
}

async function registerAndVerify(address: string): Promise<void> {
	await fixture.accounts.register(registration({ email: address }));
	await fixture.accounts.verifyEmail(verificationTokenFor(fixture.mail, address));
}

/** Pide y usa un enlace de recuperación; deja la contraseña en `nueva-contraseña-456`. */
async function resetPasswordOf(address: string): Promise<void> {
	await fixture.accounts.requestPasswordReset({ email: address, remoteIp: IP });
	const link = fixture.mail.sent.find(
		(item) => item.to === address && item.text.includes('/recuperar/nueva?token=')
	);
	const token = decodeURIComponent(/token=([^\s&]+)/.exec(link?.text ?? '')?.[1] ?? '');
	await fixture.accounts.resetPassword({ token, password: 'nueva-contraseña-456' });
}

describe('registro: dominios desechables y altas por IP', () => {
	it('un dominio desechable se rechaza sin enviar nada', async () => {
		expect(
			await codeOf(() => fixture.accounts.register(registration({ email: 'x@mailinator.com' })))
		).toBe('DISPOSABLE_DOMAIN');
		expect(fixture.mail.sent).toHaveLength(0);
	});

	it('más de registrations_per_ip_24h altas desde una IP en 24 h se rechazan', async () => {
		for (let index = 0; index < 3; index += 1) {
			await fixture.accounts.register(
				registration({ email: `persona${String(index)}@ejemplo.es` })
			);
		}

		expect(
			await codeOf(() => fixture.accounts.register(registration({ email: 'cuarta@ejemplo.es' })))
		).toBe('REGISTRATION_IP_LIMIT');
		expect(eventsNamed(fixture.logger, 'accounts.signup.rejected').at(-1)?.fields).toEqual({
			reason: 'ip_limit'
		});
	});

	it('[BE-FR-01/CA5] un email ya registrado da la misma respuesta y no envía nada', async () => {
		await fixture.accounts.register(registration());
		const sentBefore = fixture.mail.sent.length;

		const second = await fixture.accounts.register(registration());

		expect(second.sentTo).toBe(EMAIL);
		expect(fixture.mail.sent.length).toBe(sentBefore);
		expect(eventsNamed(fixture.logger, 'accounts.signup.rejected').at(-1)?.fields).toEqual({
			reason: 'email_exists'
		});
	});
});

describe('bloqueo por intentos fallidos', () => {
	it('diez fallos en 15 minutos bloquean el login, también para un email que no existe', async () => {
		const wrong = login('nadie@ejemplo.es', 'mal');
		for (let index = 0; index < 9; index += 1) {
			expect(await codeOf(() => fixture.accounts.login(wrong))).toBe('INVALID_CREDENTIALS');
		}
		expect(await codeOf(() => fixture.accounts.login(wrong))).toBe('LOGIN_TEMPORARILY_LOCKED');
		expect(await codeOf(() => fixture.accounts.login(wrong))).toBe('LOGIN_TEMPORARILY_LOCKED');
	});

	it('[BE-FR-67/CA1] el contador usa el email normalizado: las mayúsculas cuentan igual que la minúscula', async () => {
		for (let index = 0; index < 5; index += 1) {
			await codeOf(() => fixture.accounts.login(login('JUAN@ejemplo.es', 'mal')));
		}
		for (let index = 0; index < 4; index += 1) {
			await codeOf(() => fixture.accounts.login(login('juan@ejemplo.es', 'mal')));
		}

		expect(await codeOf(() => fixture.accounts.login(login('juan@ejemplo.es', 'mal')))).toBe(
			'LOGIN_TEMPORARILY_LOCKED'
		);
	});

	it('[BE-FR-67/CA2] acertar la contraseña reinicia el contador', async () => {
		await registerAndVerify(EMAIL);
		for (let index = 0; index < 9; index += 1) {
			await codeOf(() => fixture.accounts.login(login(EMAIL, 'mal')));
		}
		expect(await codeOf(() => fixture.accounts.login(login(EMAIL, PASSWORD)))).toBe('sin error');

		for (let index = 0; index < 9; index += 1) {
			expect(await codeOf(() => fixture.accounts.login(login(EMAIL, 'mal')))).toBe(
				'INVALID_CREDENTIALS'
			);
		}
	});

	it('[BE-FR-67/CA2] recuperar la contraseña también quita el bloqueo', async () => {
		await registerAndVerify(EMAIL);
		for (let index = 0; index < 10; index += 1) {
			await codeOf(() => fixture.accounts.login(login(EMAIL, 'mal')));
		}
		expect(await codeOf(() => fixture.accounts.login(login(EMAIL, PASSWORD)))).toBe(
			'LOGIN_TEMPORARILY_LOCKED'
		);

		await resetPasswordOf(EMAIL);

		expect(await codeOf(() => fixture.accounts.login(login(EMAIL, 'nueva-contraseña-456')))).toBe(
			'sin error'
		);
	});
});

describe('[C-16] bloqueo por intentos: reserva atómica frente a peticiones simultáneas (BE-FR-67, BE-FR-45)', () => {
	function attempt(email: string, password: string) {
		return codeOf(() =>
			fixture.accounts.login({ email, password, redirectTo: undefined, remoteIp: null })
		);
	}

	it('con 30 intentos a la vez, como mucho login_max_failures comprueban la contraseña y el correcto del final no entra', async () => {
		await registerAndVerify(EMAIL);
		const check = vi.spyOn(fixture.accounts.auth.api, 'signInEmail');

		const codes = await Promise.all(
			Array.from({ length: 30 }, (_, index) =>
				attempt(EMAIL, index === 29 ? PASSWORD : `mala-${String(index)}-xxxxxxxx`)
			)
		);

		expect(check.mock.calls.length).toBeLessThanOrEqual(MAX_FAILURES);
		expect(codes.filter((code) => code === 'INVALID_CREDENTIALS')).toHaveLength(MAX_FAILURES - 1);
		expect(codes.at(-1)).toBe('LOGIN_TEMPORARILY_LOCKED');
		expect(codes).not.toContain('sin error');
	});

	it('una cuenta inexistente sigue el mismo camino: el mismo número de comprobaciones y el mismo contador', async () => {
		const check = vi.spyOn(fixture.accounts.auth.api, 'signInEmail');

		const codes = await Promise.all(
			Array.from({ length: 30 }, (_, index) =>
				attempt('nadie@ejemplo.es', `mala-${String(index)}-xxxxxxxx`)
			)
		);

		expect(check.mock.calls.length).toBe(MAX_FAILURES);
		expect(codes.filter((code) => code === 'INVALID_CREDENTIALS')).toHaveLength(MAX_FAILURES - 1);
		expect(codes.filter((code) => code === 'LOGIN_TEMPORARILY_LOCKED')).toHaveLength(
			30 - (MAX_FAILURES - 1)
		);
		expect(fixture.database.db.select().from(loginAttempts).all()).toEqual([
			expect.objectContaining({ failures: MAX_FAILURES })
		]);
	});

	it('un acierto simultáneo con fallos por debajo del umbral sigue entrando', async () => {
		await registerAndVerify(EMAIL);

		const codes = await Promise.all([
			...Array.from({ length: 5 }, (_, index) => attempt(EMAIL, `mala-${String(index)}-xxxxxxxx`)),
			attempt(EMAIL, PASSWORD)
		]);

		expect(codes.at(-1)).toBe('sin error');
	});

	it('una cuenta sin verificar con la contraseña correcta no consume intentos: nunca queda bloqueada', async () => {
		await fixture.accounts.register(registration({ email: EMAIL }));

		for (let index = 0; index < MAX_FAILURES + 2; index += 1) {
			expect(await attempt(EMAIL, PASSWORD)).toBe('EMAIL_NOT_VERIFIED');
		}
		expect(fixture.database.db.select().from(loginAttempts).all()).toEqual([]);
	});

	it('un error inesperado de Better Auth deja el intento contado (falla cerrado)', async () => {
		await registerAndVerify(EMAIL);
		vi.spyOn(fixture.accounts.auth.api, 'signInEmail').mockRejectedValueOnce(
			new Error('fallo de prueba')
		);

		await expect(
			fixture.accounts.login({
				email: EMAIL,
				password: PASSWORD,
				redirectTo: undefined,
				remoteIp: null
			})
		).rejects.toThrow('fallo de prueba');

		expect(fixture.database.db.select().from(loginAttempts).all()).toEqual([
			expect.objectContaining({ failures: 1, lockedUntil: null })
		]);
	});
});

describe('[C-21] altas por IP: reserva atómica frente a peticiones simultáneas (BE-FR-11.4, BE-FR-45)', () => {
	const RAFAGA_IP = '198.51.100.9';

	it('con 8 altas a la vez desde una IP, solo registrations_per_ip_24h crean cuenta', async () => {
		const codes = await Promise.all(
			Array.from({ length: 8 }, (_, index) =>
				codeOf(() =>
					fixture.accounts.register(
						registration({ email: `rafaga${String(index)}@ejemplo.es`, remoteIp: RAFAGA_IP })
					)
				)
			)
		);

		const created = fixture.database.db
			.select()
			.from(user)
			.where(eq(user.signupIp, RAFAGA_IP))
			.all();
		expect(created).toHaveLength(SIGNUPS_PER_IP);
		expect(codes.filter((code) => code === 'REGISTRATION_IP_LIMIT')).toHaveLength(
			8 - SIGNUPS_PER_IP
		);
		// Las reservas en curso se liberan al terminar: no queda ninguna.
		expect(signupSlotRows()).toEqual([]);
	});

	it('un alta que no crea cuenta (email ya registrado) no consume hueco', async () => {
		await fixture.accounts.register(registration({ email: 'uno@ejemplo.es' }));
		await fixture.accounts.register(registration({ email: 'uno@ejemplo.es' }));
		await fixture.accounts.register(registration({ email: 'dos@ejemplo.es' }));

		expect(
			await codeOf(() => fixture.accounts.register(registration({ email: 'tres@ejemplo.es' })))
		).toBe('sin error');
		expect(
			await codeOf(() => fixture.accounts.register(registration({ email: 'cuatro@ejemplo.es' })))
		).toBe('REGISTRATION_IP_LIMIT');
	});

	it('un error inesperado al crear la cuenta libera el hueco', async () => {
		vi.spyOn(fixture.accounts.auth.api, 'signUpEmail').mockRejectedValueOnce(
			new Error('fallo de prueba')
		);
		await expect(
			fixture.accounts.register(registration({ email: 'fallo@ejemplo.es' }))
		).rejects.toThrow('fallo de prueba');

		for (let index = 0; index < SIGNUPS_PER_IP; index += 1) {
			expect(
				await codeOf(() =>
					fixture.accounts.register(registration({ email: `ok${String(index)}@ejemplo.es` }))
				)
			).toBe('sin error');
		}
		expect(signupSlotRows()).toEqual([]);
	});
});

describe('[C-24] cambio de contraseña: límite por cuenta (BE-FR-45)', () => {
	const NEW_PASSWORD = 'contraseña-nueva-de-prueba-456';

	async function webCookie(password = PASSWORD): Promise<string> {
		const web = await fixture.accounts.auth.api.signInEmail({
			body: { email: EMAIL, password },
			headers: new Headers(),
			returnHeaders: true
		});
		return web.headers
			.getSetCookie()
			.map((item) => item.split(';')[0] ?? '')
			.join('; ');
	}

	function change(cookie: string, currentPassword: string) {
		return fixture.accounts.changePassword(new Headers({ cookie }), {
			currentPassword,
			newPassword: NEW_PASSWORD
		});
	}

	it('tras login_max_failures contraseñas actuales erróneas, el siguiente intento se rechaza aunque sea la correcta', async () => {
		await registerAndVerify(EMAIL);
		const cookie = await webCookie();

		for (let index = 0; index < MAX_FAILURES - 1; index += 1) {
			expect(await change(cookie, `mala-${String(index)}-xxxxxxxx`)).toBe('wrong_password');
		}
		expect(await codeOf(() => change(cookie, 'mala-final-xxxxxxxx'))).toBe(
			'LOGIN_TEMPORARILY_LOCKED'
		);
		expect(await codeOf(() => change(cookie, PASSWORD))).toBe('LOGIN_TEMPORARILY_LOCKED');
		expect(eventsNamed(fixture.logger, 'accounts.password.change_rejected').at(-1)?.fields).toEqual(
			{ reason: 'locked' }
		);
		expect(eventsNamed(fixture.logger, 'accounts.password.changed')).toEqual([]);
	});

	it('con intentos simultáneos, como mucho login_max_failures comprueban la contraseña actual', async () => {
		await registerAndVerify(EMAIL);
		const cookie = await webCookie();
		const check = vi.spyOn(fixture.accounts.auth.api, 'changePassword');

		await Promise.all(
			Array.from({ length: 20 }, (_, index) =>
				codeOf(() => change(cookie, `mala-${String(index)}-xxxxxxxx`))
			)
		);

		expect(check.mock.calls.length).toBeLessThanOrEqual(MAX_FAILURES);
	});

	it('un acierto antes del umbral pone el contador a cero', async () => {
		await registerAndVerify(EMAIL);
		const cookie = await webCookie();
		for (let index = 0; index < MAX_FAILURES - 1; index += 1) {
			await change(cookie, `mala-${String(index)}-xxxxxxxx`);
		}
		expect(await change(cookie, PASSWORD)).toBe('changed');

		// La cookie anterior ya no vale (se revocan las sesiones): se entra con la contraseña nueva.
		const fresh = await webCookie(NEW_PASSWORD);
		for (let index = 0; index < MAX_FAILURES - 1; index += 1) {
			expect(
				await fixture.accounts.changePassword(new Headers({ cookie: fresh }), {
					currentPassword: `mala-${String(index)}-xxxxxxxx`,
					newPassword: 'otra-contraseña-de-prueba-789'
				})
			).toBe('wrong_password');
		}
	});

	describe('contador de sesión, separado del login y compartido con el cambio de email y el borrado', () => {
		const wrongLogin = () => ({ ...login(EMAIL, 'mal'), remoteIp: null });

		function userIdOf(address: string): string {
			const row = fixture.database.db
				.select({ id: user.id })
				.from(user)
				.where(eq(user.email, address))
				.get();
			if (row === undefined) throw new Error('la cuenta debía existir');
			return row.id;
		}

		function emailChange(currentPassword: string) {
			return fixture.accounts.requestEmailChange({
				userId: userIdOf(EMAIL),
				currentPassword,
				newEmail: 'nueva-direccion@ejemplo.es',
				remoteIp: null
			});
		}

		it('con el login bloqueado para su email, el titular con sesión puede cambiar la contraseña', async () => {
			await registerAndVerify(EMAIL);
			const cookie = await webCookie();
			for (let index = 0; index < MAX_FAILURES; index += 1) {
				await codeOf(() => fixture.accounts.login(wrongLogin()));
			}
			expect(await codeOf(() => fixture.accounts.login(wrongLogin()))).toBe(
				'LOGIN_TEMPORARILY_LOCKED'
			);

			expect(await change(cookie, PASSWORD)).toBe('changed');
		});

		it('con el contador de sesión bloqueado, el login con la contraseña correcta sigue entrando', async () => {
			await registerAndVerify(EMAIL);
			const cookie = await webCookie();
			for (let index = 0; index < MAX_FAILURES - 1; index += 1) {
				await change(cookie, `mala-${String(index)}-xxxxxxxx`);
			}
			expect(await codeOf(() => change(cookie, 'mala-final-xxxxxxxx'))).toBe(
				'LOGIN_TEMPORARILY_LOCKED'
			);

			expect(
				await codeOf(() => fixture.accounts.login({ ...login(EMAIL, PASSWORD), remoteIp: null }))
			).toBe('sin error');
		});

		it('un acierto en una operación de sesión pone a cero su contador, no el del login', async () => {
			await registerAndVerify(EMAIL);
			const cookie = await webCookie();
			for (let index = 0; index < 3; index += 1) {
				await codeOf(() => fixture.accounts.login(wrongLogin()));
			}
			await change(cookie, 'mala-xxxxxxxx');

			expect(await change(cookie, PASSWORD)).toBe('changed');

			const rows = fixture.database.db.select().from(loginAttempts).all();
			expect(rows.map((row) => row.failures)).toEqual([3]);
		});

		it('un login correcto no pone a cero el contador de sesión', async () => {
			await registerAndVerify(EMAIL);
			const cookie = await webCookie();
			for (let index = 0; index < 3; index += 1) {
				await change(cookie, `mala-${String(index)}-xxxxxxxx`);
			}
			expect(
				await codeOf(() => fixture.accounts.login({ ...login(EMAIL, PASSWORD), remoteIp: null }))
			).toBe('sin error');

			for (let index = 3; index < MAX_FAILURES - 1; index += 1) {
				expect(await change(cookie, `mala-${String(index)}-xxxxxxxx`)).toBe('wrong_password');
			}
			expect(await codeOf(() => change(cookie, 'mala-final-xxxxxxxx'))).toBe(
				'LOGIN_TEMPORARILY_LOCKED'
			);
		});

		it('el cambio de email comparte el contador: el intento que alcanza el umbral y los siguientes responden 429', async () => {
			await registerAndVerify(EMAIL);
			const cookie = await webCookie();
			for (let index = 0; index < 5; index += 1) {
				await change(cookie, `mala-${String(index)}-xxxxxxxx`);
			}
			for (let index = 5; index < MAX_FAILURES - 1; index += 1) {
				expect(await emailChange(`mala-${String(index)}-xxxxxxxx`)).toBe('wrong_password');
			}

			const locked = await emailChange('mala-final-xxxxxxxx').then(
				() => null,
				(error: unknown) => error
			);
			expect(locked).toMatchObject({
				code: 'LOGIN_TEMPORARILY_LOCKED',
				details: { retryAfterMinutes: 15 }
			});
			expect(await codeOf(() => emailChange(PASSWORD))).toBe('LOGIN_TEMPORARILY_LOCKED');
			expect(eventsNamed(fixture.logger, 'accounts.email_change.rejected').at(-1)?.fields).toEqual({
				reason: 'locked'
			});
			expect(eventsNamed(fixture.logger, 'accounts.email_change.requested')).toEqual([]);
		});

		it('con cambios de email simultáneos, solo login_max_failures comprueban la contraseña', async () => {
			await registerAndVerify(EMAIL);

			const outcomes = await Promise.all(
				Array.from({ length: 20 }, (_, index) =>
					emailChange(`mala-${String(index)}-xxxxxxxx`).then(
						(outcome) => outcome,
						(error: unknown) => (error instanceof Error && 'code' in error ? error.code : error)
					)
				)
			);

			expect(outcomes.filter((item) => item === 'wrong_password')).toHaveLength(MAX_FAILURES - 1);
			expect(outcomes.filter((item) => item === 'LOGIN_TEMPORARILY_LOCKED')).toHaveLength(
				20 - (MAX_FAILURES - 1)
			);
		});

		it('un cambio de email con la contraseña correcta pone el contador de sesión a cero', async () => {
			await registerAndVerify(EMAIL);
			for (let index = 0; index < MAX_FAILURES - 1; index += 1) {
				await emailChange(`mala-${String(index)}-xxxxxxxx`);
			}
			expect(await emailChange(PASSWORD)).toBe('sent');

			for (let index = 0; index < MAX_FAILURES - 1; index += 1) {
				expect(await emailChange(`mala-${String(index)}-xxxxxxxx`)).toBe('wrong_password');
			}
		});
	});
});

describe('antienumeración', () => {
	it('pedir recuperación de un email inexistente responde igual y no envía nada', async () => {
		const sentBefore = fixture.mail.sent.length;
		await fixture.accounts.requestPasswordReset({ email: 'nadie@ejemplo.es', remoteIp: IP });

		expect(fixture.mail.sent.length).toBe(sentBefore);
		expect(eventsNamed(fixture.logger, 'accounts.password.reset_requested')[0]?.fields).toEqual({
			status: 'suppressed'
		});
	});

	it('reenviar la verificación de un email inexistente responde igual y no envía nada', async () => {
		const sentBefore = fixture.mail.sent.length;

		await expect(
			fixture.accounts.resendVerification({ email: 'nadie@ejemplo.es', remoteIp: IP })
		).resolves.toBeUndefined();
		expect(fixture.mail.sent.length).toBe(sentBefore);
	});

	it('los eventos de estos caminos no llevan el email ni la IP', async () => {
		await registerAndVerify(EMAIL);
		await fixture.accounts.register(registration({ email: EMAIL }));
		await codeOf(() => fixture.accounts.login(login(EMAIL, 'mal')));
		await fixture.accounts.requestPasswordReset({ email: EMAIL, remoteIp: IP });

		const events = [
			...eventsNamed(fixture.logger, 'accounts.signup.rejected'),
			...eventsNamed(fixture.logger, 'accounts.login.failed'),
			...eventsNamed(fixture.logger, 'accounts.password.reset_requested')
		];
		expect(events.length).toBeGreaterThan(0);
		expect(JSON.stringify(events)).not.toContain(EMAIL);
		expect(JSON.stringify(events)).not.toContain(IP);
	});
});
