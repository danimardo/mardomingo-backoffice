// Antiabuso de las cuentas contra SQLite real (T095; BE-FR-01/CA4, BE-FR-11.2, BE-FR-11.4, BE-FR-67/CA1–CA2): dominios
// desechables, altas por IP, bloqueo por intentos y antienumeración. Los eventos no llevan email ni IP (15.19).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

let fixture: AccountsFixture;

beforeEach(() => {
	fixture = accountsFixture();
});

afterEach(() => {
	fixture.close();
});

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
