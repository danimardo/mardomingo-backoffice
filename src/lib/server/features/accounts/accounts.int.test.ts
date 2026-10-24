// Cuentas de punta a punta contra SQLite real (T108; BE-FR-01, 02, 03, 05, 10, 11, 64, 67, 69): registro, aceptaciones,
// verificación, inicio de sesión y su cuenta bloqueada, recuperación, promoción de ADMIN_EMAIL y sesiones. El antiabuso
// (dominios desechables, altas por IP, bloqueo por intentos y antienumeración) está en `abuse.int.test.ts` (T095).
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import {
	ADMIN_EMAIL,
	EMAIL,
	IP,
	PASSWORD,
	VERSIONS,
	accountsFixture,
	codeOf,
	registration,
	verificationTokenFor,
	type AccountsFixture
} from '../../../../../tests/builders/accounts';
import { createAccounts } from './index';
import { user } from './schema';
import { termsAcceptances } from '../legal/schema';

let fixture: AccountsFixture;

beforeEach(() => {
	fixture = accountsFixture();
});

afterEach(() => {
	fixture.close();
});

function db() {
	return fixture.database.db;
}

async function registerAndVerify(address: string): Promise<void> {
	await fixture.accounts.register(registration({ email: address }));
	await fixture.accounts.verifyEmail(verificationTokenFor(fixture.mail, address));
}

/** Token de sesión (plugin Bearer) de una cuenta ya verificada; el servicio de login solo devuelve la ruta de destino. */
async function bearerOf(address: string): Promise<string> {
	const login = await fixture.accounts.auth.api.signInEmail({
		body: { email: address, password: PASSWORD },
		headers: new Headers()
	});
	return login.token;
}

describe('registro (W08)', () => {
	it('[BE-FR-01/CA4] un registro válido crea la cuenta sin verificar, guarda las aceptaciones y envía el enlace', async () => {
		const result = await fixture.accounts.register(registration({ appSlug: 'secretario' }));

		expect(result.sentTo).toBe(EMAIL);
		const row = db().select().from(user).where(eq(user.email, EMAIL)).get();
		expect(row).toMatchObject({
			emailVerified: false,
			emailNormalized: 'juan@ejemplo.es',
			signupIp: IP
		});
		const accepted = db()
			.select()
			.from(termsAcceptances)
			.where(eq(termsAcceptances.userId, row?.id ?? ''))
			.all();
		expect(accepted.map((item) => item.document).sort()).toEqual([
			'age_declaration',
			'aup',
			'privacy',
			'terms'
		]);
		expect(
			fixture.mail.sent.some((item) =>
				item.text.includes('https://cuenta.mardomingo.test/verificar?token=')
			)
		).toBe(true);
		expect(eventsNamed(fixture.logger, 'accounts.signup.completed')).toHaveLength(1);
	});

	it('[BE-FR-01/CA2] [BE-FR-64/CA1] el alta guarda la app de origen y la versión y fecha de cada aceptación', async () => {
		await fixture.accounts.register(registration({ appSlug: 'secretario' }));

		const row = db().select().from(user).where(eq(user.email, EMAIL)).get();
		expect(row?.signupAppId).toBe('app_secretario');

		const accepted = db()
			.select()
			.from(termsAcceptances)
			.where(eq(termsAcceptances.userId, row?.id ?? ''))
			.all();
		for (const document of ['terms', 'privacy', 'aup'] as const) {
			const item = accepted.find((entry) => entry.document === document);
			expect(item?.version).toBe(VERSIONS[document]);
			expect(typeof item?.acceptedAt).toBe('number');
		}
	});

	it('[BE-FR-01/CA3] sin captcha válido no se crea nada', async () => {
		fixture.captcha.outcome('invalid');

		expect(await codeOf(() => fixture.accounts.register(registration()))).toBe('CAPTCHA_INVALID');
		expect(db().select().from(user).all()).toHaveLength(0);
		expect(eventsNamed(fixture.logger, 'accounts.signup.rejected')[0]?.fields).toEqual({
			reason: 'captcha_invalid'
		});
	});

	it('si el captcha no está disponible, se reporta y se puede reintentar', async () => {
		fixture.captcha.outcome('unavailable');

		expect(await codeOf(() => fixture.accounts.register(registration()))).toBe('CAPTCHA_INVALID');
		expect(eventsNamed(fixture.logger, 'accounts.captcha.unavailable')).toHaveLength(1);
	});

	it('si la versión legal cambió mientras el formulario estaba abierto, se rechaza', async () => {
		expect(
			await codeOf(() =>
				fixture.accounts.register(registration({ versions: { ...VERSIONS, terms: '2025-01-01' } }))
			)
		).toBe('LEGAL_VERSION_CHANGED');
	});
});

describe('verificación (W09) e inicio de sesión (W11)', () => {
	it('[UX-04] sin verificar no se puede entrar; tras verificar, sí, y el destino queda saneado', async () => {
		await fixture.accounts.register(registration());
		expect(
			await codeOf(() =>
				fixture.accounts.login({
					email: EMAIL,
					password: PASSWORD,
					redirectTo: undefined,
					remoteIp: IP
				})
			)
		).toBe('EMAIL_NOT_VERIFIED');

		await fixture.accounts.verifyEmail(verificationTokenFor(fixture.mail, EMAIL));
		const login = await fixture.accounts.login({
			email: EMAIL,
			password: PASSWORD,
			redirectTo: 'https://evil.example',
			remoteIp: IP
		});

		expect(login.redirectTo).toBe('/panel');
		expect(eventsNamed(fixture.logger, 'accounts.login.succeeded')).toHaveLength(1);
	});

	it('un token ya usado da TOKEN_USED', async () => {
		await fixture.accounts.register(registration());
		const token = verificationTokenFor(fixture.mail, EMAIL);
		await fixture.accounts.verifyEmail(token);

		expect(await codeOf(() => fixture.accounts.verifyEmail(token))).toBe('TOKEN_USED');
	});

	it('un token inventado da TOKEN_INVALID', async () => {
		expect(await codeOf(() => fixture.accounts.verifyEmail('token-inventado'))).toBe(
			'TOKEN_INVALID'
		);
	});

	it('el enlace de verificación vale 24 horas: a las 23 h 59 sirve y a las 24 h 01 caduca', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		try {
			vi.setSystemTime(new Date('2026-10-11T08:00:00Z'));
			await fixture.accounts.register(registration({ email: 'vale@ejemplo.es' }));
			await fixture.accounts.register(registration({ email: 'caduca@ejemplo.es' }));
			const valid = verificationTokenFor(fixture.mail, 'vale@ejemplo.es');
			const expired = verificationTokenFor(fixture.mail, 'caduca@ejemplo.es');

			vi.setSystemTime(new Date('2026-10-12T07:59:00Z'));
			await expect(fixture.accounts.verifyEmail(valid)).resolves.toBeDefined();

			vi.setSystemTime(new Date('2026-10-12T08:01:00Z'));
			expect(await codeOf(() => fixture.accounts.verifyEmail(expired))).toBe('TOKEN_EXPIRED');
		} finally {
			vi.useRealTimers();
		}
	});

	it('[BE-FR-03/CA2] una cuenta bloqueada no entra y se dice como cuenta bloqueada', async () => {
		await registerAndVerify(EMAIL);
		db().update(user).set({ banned: true }).where(eq(user.email, EMAIL)).run();

		expect(
			await codeOf(() =>
				fixture.accounts.login({
					email: EMAIL,
					password: PASSWORD,
					redirectTo: undefined,
					remoteIp: IP
				})
			)
		).toBe('ACCOUNT_BLOCKED');
		expect(eventsNamed(fixture.logger, 'accounts.login.failed').at(-1)?.fields).toEqual({
			reason: 'blocked',
			errorCode: 'ACCOUNT_BLOCKED'
		});
	});
});

describe('recuperación de contraseña (W12, W13)', () => {
	it('el enlace cambia la contraseña una vez, avisa por email y no sirve de nuevo', async () => {
		await registerAndVerify(EMAIL);
		await fixture.accounts.requestPasswordReset({ email: EMAIL, remoteIp: IP });

		const resetLink = fixture.mail.sent.find((item) =>
			item.text.includes('/recuperar/nueva?token=')
		);
		const token = decodeURIComponent(/token=([^\s&]+)/.exec(resetLink?.text ?? '')?.[1] ?? '');
		await fixture.accounts.resetPassword({ token, password: 'nueva-contraseña-456' });

		expect(fixture.mail.sent.some((item) => item.subject === 'Tu contraseña ha cambiado')).toBe(
			true
		);
		const login = await fixture.accounts.login({
			email: EMAIL,
			password: 'nueva-contraseña-456',
			redirectTo: undefined,
			remoteIp: IP
		});
		expect(login.redirectTo).toBe('/panel');
		expect(
			await codeOf(() => fixture.accounts.resetPassword({ token, password: 'otra-contraseña-789' }))
		).toBe('TOKEN_INVALID');
	});
});

describe('estado de los tokens sin consumirlos (W09, W13)', () => {
	it('el enlace de recuperación se ve válido antes de usarlo, y no válido después', async () => {
		await registerAndVerify(EMAIL);
		await fixture.accounts.requestPasswordReset({ email: EMAIL, remoteIp: IP });
		const resetLink = fixture.mail.sent.find((item) =>
			item.text.includes('/recuperar/nueva?token=')
		);
		const token = decodeURIComponent(/token=([^\s&]+)/.exec(resetLink?.text ?? '')?.[1] ?? '');

		expect(fixture.accounts.tokenState(token, 'reset')).toBe('valid');
		expect(fixture.accounts.tokenState('token-inventado', 'reset')).toBe('invalid');

		await fixture.accounts.resetPassword({ token, password: 'nueva-contraseña-456' });

		expect(fixture.accounts.tokenState(token, 'reset')).toBe('invalid');
	});

	it('el enlace de verificación se ve válido y después usado', async () => {
		await fixture.accounts.register(registration());
		const token = verificationTokenFor(fixture.mail, EMAIL);

		expect(fixture.accounts.tokenState(token, 'verification')).toBe('valid');

		await fixture.accounts.verifyEmail(token);

		expect(fixture.accounts.tokenState(token, 'verification')).toBe('used');
	});
});

describe('administrador por ADMIN_EMAIL', () => {
	it('la cuenta con ADMIN_EMAIL pasa a administrador al verificar', async () => {
		await registerAndVerify(ADMIN_EMAIL);

		const admin = db().select().from(user).where(eq(user.email, ADMIN_EMAIL)).get();
		expect(admin?.role.split(',')).toContain('admin');
		expect(eventsNamed(fixture.logger, 'accounts.admin.promoted')).toHaveLength(1);
	});

	it('si ya hay otro administrador, ADMIN_EMAIL no promueve a nadie más (accounts.admin.promotion_refused)', async () => {
		await registerAndVerify(ADMIN_EMAIL);
		// Cambio de configuración: ahora otra dirección es la de ADMIN_EMAIL, con el mismo registro y la misma base.
		const reconfigured = createAccounts({
			...fixture.config,
			adminEmail: 'segundo@mardomingo.test'
		});
		await reconfigured.register(registration({ email: 'segundo@mardomingo.test' }));
		await reconfigured.verifyEmail(verificationTokenFor(fixture.mail, 'segundo@mardomingo.test'));

		const second = db().select().from(user).where(eq(user.email, 'segundo@mardomingo.test')).get();
		expect(second?.role.split(',')).not.toContain('admin');
		expect(eventsNamed(fixture.logger, 'accounts.admin.promotion_refused')).toEqual([
			expect.objectContaining({ fields: { reason: 'admin_exists' } })
		]);
	});
});

describe('sesiones', () => {
	it('sin cabeceras válidas no hay sesión', async () => {
		expect(await fixture.accounts.readSession(new Headers())).toBeNull();
	});

	it('[BE-FR-04/CA2] cerrar sesión la revoca al momento: la siguiente lectura ya no la ve', async () => {
		await registerAndVerify(EMAIL);
		const headers = new Headers({ authorization: `Bearer ${await bearerOf(EMAIL)}` });
		expect(await fixture.accounts.readSession(headers)).not.toBeNull();

		await fixture.accounts.logout(headers);

		expect(await fixture.accounts.readSession(headers)).toBeNull();
	});

	it('[BE-FR-04/CA1] la sesión se renueva al usarla y caduca tras 30 días sin uso', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		try {
			vi.setSystemTime(new Date('2026-10-11T08:00:00Z'));
			await registerAndVerify(EMAIL);
			const headers = new Headers({ authorization: `Bearer ${await bearerOf(EMAIL)}` });

			// A las 25 h la sesión tiene más de un día: al usarla se renueva hasta 30 días después.
			vi.setSystemTime(new Date('2026-10-12T09:00:00Z'));
			expect(await fixture.accounts.readSession(headers)).not.toBeNull();

			// 29 días después sigue viva porque la renovación anterior la alargó.
			vi.setSystemTime(new Date('2026-11-10T09:00:00Z'));
			expect(await fixture.accounts.readSession(headers)).not.toBeNull();

			// 31 días sin uso: caducada.
			vi.setSystemTime(new Date('2026-12-11T09:00:00Z'));
			expect(await fixture.accounts.readSession(headers)).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});
});

describe('bienvenida al verificar (BE-FR-02 CA1, BE-FR-11 CA1)', () => {
	function idOf(address: string): string {
		return db().select({ id: user.id }).from(user).where(eq(user.email, address)).get()?.id ?? '';
	}

	it('[BE-FR-02/CA1] verificar concede la bolsa de bienvenida de 1.000 créditos', async () => {
		await fixture.accounts.register(registration({ email: EMAIL }));
		await fixture.accounts.verifyEmail(verificationTokenFor(fixture.mail, EMAIL));

		expect(fixture.config.credits.getBalance(idOf(EMAIL)).totalMicro).toBe(1_000_000_000);
	});

	it('[BE-FR-11/CA1] una segunda dirección del mismo buzón de gmail no recibe la bienvenida', async () => {
		const base = 'juan.perez@gmail.com';
		const plus = 'juanperez+2@gmail.com';
		await fixture.accounts.register(registration({ email: base }));
		await fixture.accounts.verifyEmail(verificationTokenFor(fixture.mail, base));
		await fixture.accounts.register(registration({ email: plus }));
		await fixture.accounts.verifyEmail(verificationTokenFor(fixture.mail, plus));

		expect(fixture.config.credits.getBalance(idOf(base)).totalMicro).toBe(1_000_000_000);
		expect(fixture.config.credits.getBalance(idOf(plus)).totalMicro).toBe(0);
		expect(fixture.config.credits.welcomeOf(idOf(plus))).toBeNull();
	});
});
