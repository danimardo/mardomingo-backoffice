// Cuentas de punta a punta contra SQLite real (T108; BE-FR-01, 02, 03, 05, 11, 67): registro con su antiabuso,
// verificación, login y su bloqueo, recuperación, promoción de ADMIN_EMAIL y cierre. Captcha, email y reloj, falsos.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	createFakeCaptchaVerifier,
	type FakeCaptchaVerifier
} from '$lib/server/adapters/turnstile/fake-verifier';
import {
	createFakeEmailSender,
	type FakeEmailSender
} from '$lib/server/adapters/resend/fake-sender';
import { AppError, type ErrorCode } from '$lib/server/shared/errors';
import { createIdGenerator } from '$lib/server/shared/ids';
import { copyOfTemplate, type TestDatabase } from '../../../../../tests/builders/database';
import { fixedClock } from '../../../../../tests/builders/apps';
import {
	createFakeLogger,
	eventsNamed,
	type FakeLogger
} from '../../../../../tests/builders/fake-logger';
import { seededRandomBytes } from '../../../../../tests/builders/ids';
import { createAccounts, type Accounts } from './index';
import { user } from './schema';
import { termsAcceptances } from '../legal/schema';
import { toEpochMs } from '$lib/shared/time';

const PASSWORD = 'contraseña-larga-123';
const EMAIL = 'juan@ejemplo.es';
const ADMIN_EMAIL = 'admin@mardomingo.test';
const VERSIONS = { terms: '2026-10-11', privacy: '2026-10-11', aup: '2026-10-11' };
const IP = '203.0.113.7';

let database: TestDatabase | undefined;
let logger: FakeLogger;
let captcha: FakeCaptchaVerifier;
let mail: FakeEmailSender;
let accounts: Accounts;

beforeEach(() => {
	database = copyOfTemplate();
	logger = createFakeLogger();
	captcha = createFakeCaptchaVerifier('valid');
	mail = createFakeEmailSender();
	const db = database.db;
	// Reloj real del momento: Better Auth guarda `created_at` con el reloj real, y el límite por IP mira las últimas 24 h.
	const clock = fixedClock(toEpochMs(Date.now()));
	const ids = createIdGenerator(seededRandomBytes(21));
	accounts = createAccounts({
		db,
		logger,
		clock,
		ids,
		captcha,
		notifications: { sender: mail, logger, supportEmail: () => 'soporte@mardomingo.com' },
		apps: { db, logger, clock, ids },
		legal: { db, logger, ids },
		emailHashKey: 'clave-de-hash-de-prueba-de-32-caracteres!!',
		adminEmail: ADMIN_EMAIL,
		authSecret: 'secreto-de-prueba-de-al-menos-32-caracteres',
		publicWebUrl: 'https://cuenta.mardomingo.test'
	});
});

afterEach(() => {
	database?.dispose();
	database = undefined;
});

function db(): TestDatabase['db'] {
	if (database === undefined) throw new Error('sin base de datos');
	return database.db;
}

/** Código de error de aplicación de una promesa que debe fallar. */
async function codeOf(action: () => Promise<unknown>): Promise<ErrorCode | 'sin error'> {
	try {
		await action();
		return 'sin error';
	} catch (error) {
		return error instanceof AppError ? error.code : 'sin error';
	}
}

function registration(overrides: Partial<Parameters<Accounts['register']>[0]> = {}) {
	return {
		email: EMAIL,
		password: PASSWORD,
		captchaToken: 'token-valido',
		remoteIp: IP,
		appSlug: null,
		versions: VERSIONS,
		ageDeclared: true,
		...overrides
	};
}

/** Token de verificación del último email enviado a esa dirección. */
function verificationTokenFor(address: string): string {
	const sent = mail.sent.filter(
		(item) => item.to === address && item.text.includes('/verificar?token=')
	);
	const last = sent[sent.length - 1];
	const match = /token=([^\s&]+)/.exec(last?.text ?? '');
	if (match?.[1] === undefined) throw new Error('no hay token de verificación');
	return decodeURIComponent(match[1]);
}

describe('registro (W08) y su antiabuso', () => {
	it('un registro válido crea la cuenta sin verificar, guarda las aceptaciones y envía el enlace', async () => {
		const result = await accounts.register(registration({ appSlug: 'secretario' }));

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
			mail.sent.some((item) =>
				item.text.includes('https://cuenta.mardomingo.test/verificar?token=')
			)
		).toBe(true);
		expect(eventsNamed(logger, 'accounts.signup.completed')).toHaveLength(1);
	});

	it('sin captcha válido no se crea nada', async () => {
		captcha.outcome('invalid');

		expect(await codeOf(() => accounts.register(registration()))).toBe('CAPTCHA_INVALID');
		expect(db().select().from(user).all()).toHaveLength(0);
		expect(eventsNamed(logger, 'accounts.signup.rejected')[0]?.fields).toEqual({
			reason: 'captcha_invalid'
		});
	});

	it('si el captcha no está disponible, se reporta y se puede reintentar', async () => {
		captcha.outcome('unavailable');

		expect(await codeOf(() => accounts.register(registration()))).toBe('CAPTCHA_INVALID');
		expect(eventsNamed(logger, 'accounts.captcha.unavailable')).toHaveLength(1);
	});

	it('un dominio desechable se rechaza', async () => {
		expect(await codeOf(() => accounts.register(registration({ email: 'x@mailinator.com' })))).toBe(
			'DISPOSABLE_DOMAIN'
		);
	});

	it('más de registrations_per_ip_24h altas desde una IP en 24 h se rechazan', async () => {
		for (let index = 0; index < 3; index += 1) {
			await accounts.register(registration({ email: `persona${String(index)}@ejemplo.es` }));
		}

		expect(
			await codeOf(() => accounts.register(registration({ email: 'cuarta@ejemplo.es' })))
		).toBe('REGISTRATION_IP_LIMIT');
	});

	it('si la versión legal cambió mientras el formulario estaba abierto, se rechaza', async () => {
		expect(
			await codeOf(() =>
				accounts.register(registration({ versions: { ...VERSIONS, terms: '2025-01-01' } }))
			)
		).toBe('LEGAL_VERSION_CHANGED');
	});

	it('un email ya registrado da la misma respuesta y no envía nada', async () => {
		await accounts.register(registration());
		const sentBefore = mail.sent.length;

		const second = await accounts.register(registration());

		expect(second.sentTo).toBe(EMAIL);
		expect(mail.sent.length).toBe(sentBefore);
		expect(eventsNamed(logger, 'accounts.signup.rejected').at(-1)?.fields).toEqual({
			reason: 'email_exists'
		});
	});
});

describe('verificación (W09) e inicio de sesión (W11)', () => {
	it('sin verificar no se puede entrar; tras verificar, sí, y el destino queda saneado', async () => {
		await accounts.register(registration());
		expect(
			await codeOf(() =>
				accounts.login({ email: EMAIL, password: PASSWORD, redirectTo: undefined, remoteIp: IP })
			)
		).toBe('EMAIL_NOT_VERIFIED');

		await accounts.verifyEmail(verificationTokenFor(EMAIL));
		const login = await accounts.login({
			email: EMAIL,
			password: PASSWORD,
			redirectTo: 'https://evil.example',
			remoteIp: IP
		});

		expect(login.redirectTo).toBe('/panel');
		expect(eventsNamed(logger, 'accounts.login.succeeded')).toHaveLength(1);
	});

	it('un token ya usado da TOKEN_USED', async () => {
		await accounts.register(registration());
		const token = verificationTokenFor(EMAIL);
		await accounts.verifyEmail(token);

		expect(await codeOf(() => accounts.verifyEmail(token))).toBe('TOKEN_USED');
	});

	it('un token inventado da TOKEN_INVALID', async () => {
		expect(await codeOf(() => accounts.verifyEmail('token-inventado'))).toBe('TOKEN_INVALID');
	});

	it('diez fallos en 15 minutos bloquean el login, también para un email que no existe', async () => {
		const wrong = {
			email: 'nadie@ejemplo.es',
			password: 'mal',
			redirectTo: undefined,
			remoteIp: IP
		};
		for (let index = 0; index < 9; index += 1) {
			expect(await codeOf(() => accounts.login(wrong))).toBe('INVALID_CREDENTIALS');
		}
		expect(await codeOf(() => accounts.login(wrong))).toBe('LOGIN_TEMPORARILY_LOCKED');
		expect(await codeOf(() => accounts.login(wrong))).toBe('LOGIN_TEMPORARILY_LOCKED');
	});
});

describe('recuperación de contraseña (W12, W13)', () => {
	it('el enlace cambia la contraseña una vez, avisa por email y limpia el bloqueo', async () => {
		await accounts.register(registration());
		await accounts.verifyEmail(verificationTokenFor(EMAIL));
		await accounts.requestPasswordReset({ email: EMAIL, remoteIp: IP });

		const resetLink = mail.sent.find((item) => item.text.includes('/recuperar/nueva?token='));
		const token = decodeURIComponent(/token=([^\s&]+)/.exec(resetLink?.text ?? '')?.[1] ?? '');
		await accounts.resetPassword({ token, password: 'nueva-contraseña-456' });

		expect(mail.sent.some((item) => item.subject === 'Tu contraseña ha cambiado')).toBe(true);
		const login = await accounts.login({
			email: EMAIL,
			password: 'nueva-contraseña-456',
			redirectTo: undefined,
			remoteIp: IP
		});
		expect(login.redirectTo).toBe('/panel');
		expect(
			await codeOf(() => accounts.resetPassword({ token, password: 'otra-contraseña-789' }))
		).toBe('TOKEN_INVALID');
	});

	it('pedir recuperación para un email inexistente no envía nada y responde igual', async () => {
		const sentBefore = mail.sent.length;
		await accounts.requestPasswordReset({ email: 'nadie@ejemplo.es', remoteIp: IP });

		expect(mail.sent.length).toBe(sentBefore);
		expect(eventsNamed(logger, 'accounts.password.reset_requested')[0]?.fields).toEqual({
			status: 'suppressed'
		});
	});
});

describe('administrador por ADMIN_EMAIL', () => {
	it('la cuenta con ADMIN_EMAIL pasa a administrador al verificar, y solo hay uno', async () => {
		await accounts.register(registration({ email: ADMIN_EMAIL }));
		await accounts.verifyEmail(verificationTokenFor(ADMIN_EMAIL));
		const admin = db().select().from(user).where(eq(user.email, ADMIN_EMAIL)).get();
		expect(admin?.role.split(',')).toContain('admin');

		await accounts.register(registration({ email: 'otro@ejemplo.es' }));
		await accounts.register(registration({ email: 'otro-admin@mardomingo.test' }));
		await accounts.verifyEmail(verificationTokenFor('otro-admin@mardomingo.test'));
		expect(eventsNamed(logger, 'accounts.admin.promoted')).toHaveLength(1);
	});
});

describe('cierre de sesión (W15)', () => {
	it('una sesión sin cabeceras válidas no existe para getSession', async () => {
		const session = await accounts.readSession(new Headers());
		expect(session).toBeNull();
	});
});
