// Montaje de cuentas para las pruebas de integración (T095, T108): base de datos real de la plantilla, captcha, email y
// registrador falsos, y el reloj del momento. Lo comparten `accounts.int.test.ts` y `abuse.int.test.ts`.
import {
	createFakeCaptchaVerifier,
	type FakeCaptchaVerifier
} from '$lib/server/adapters/turnstile/fake-verifier';
import {
	createFakeEmailSender,
	type FakeEmailSender
} from '$lib/server/adapters/resend/fake-sender';
import { createAccounts, type Accounts, type AccountsConfig } from '$lib/server/features/accounts';
import { createCredits } from '$lib/server/features/credits';
import { AppError, type ErrorCode } from '$lib/server/shared/errors';
import { createIdGenerator } from '$lib/server/shared/ids';
import { toEpochMs } from '$lib/shared/time';
import { fixedClock } from './apps';
import { copyOfTemplate, type TestDatabase } from './database';
import { createFakeLogger, type FakeLogger } from './fake-logger';
import { seededRandomBytes } from './ids';

export const PASSWORD = 'contraseña-larga-123';
export const EMAIL = 'juan@ejemplo.es';
export const ADMIN_EMAIL = 'admin@mardomingo.test';
export const VERSIONS = { terms: '2026-10-11', privacy: '2026-10-11', aup: '2026-10-11' };
export const IP = '203.0.113.7';

export interface AccountsFixture {
	readonly database: TestDatabase;
	readonly logger: FakeLogger;
	readonly captcha: FakeCaptchaVerifier;
	readonly mail: FakeEmailSender;
	readonly config: AccountsConfig;
	readonly accounts: Accounts;
	close(): void;
}

export function accountsFixture(): AccountsFixture {
	const database = copyOfTemplate();
	const logger = createFakeLogger();
	const captcha = createFakeCaptchaVerifier('valid');
	const mail = createFakeEmailSender();
	const db = database.db;
	// Reloj real del momento: Better Auth guarda `created_at` con el reloj real, y el límite por IP mira las últimas 24 h.
	const clock = fixedClock(toEpochMs(Date.now()));
	const ids = createIdGenerator(seededRandomBytes(21));
	const credits = createCredits({
		db,
		logger,
		clock,
		ids,
		apps: { db, logger, clock, ids },
		auditDeps: { clock, ids, logger }
	});
	const config: AccountsConfig = {
		db,
		logger,
		clock,
		ids,
		captcha,
		notifications: { sender: mail, logger, supportEmail: () => 'soporte@mardomingo.com' },
		apps: { db, logger, clock, ids },
		legal: { db, logger, ids },
		credits,
		emailHashKey: 'clave-de-hash-de-prueba-de-32-caracteres!!',
		adminEmail: ADMIN_EMAIL,
		authSecret: 'secreto-de-prueba-de-al-menos-32-caracteres',
		publicWebUrl: 'https://cuenta.mardomingo.test'
	};
	return {
		database,
		logger,
		captcha,
		mail,
		config,
		accounts: createAccounts(config),
		close: () => {
			database.dispose();
		}
	};
}

/** Datos válidos de un registro; cada prueba cambia solo lo que quiere probar. */
export function registration(overrides: Partial<Parameters<Accounts['register']>[0]> = {}) {
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
export function verificationTokenFor(mail: FakeEmailSender, address: string): string {
	const sent = mail.sent.filter(
		(item) => item.to === address && item.text.includes('/verificar?token=')
	);
	const last = sent[sent.length - 1];
	const match = /token=([^\s&]+)/.exec(last?.text ?? '');
	if (match?.[1] === undefined) throw new Error('no hay token de verificación');
	return decodeURIComponent(match[1]);
}

/** Código de error de aplicación de una promesa que debe fallar; «sin error» si no falla. */
export async function codeOf(action: () => Promise<unknown>): Promise<ErrorCode | 'sin error'> {
	try {
		await action();
		return 'sin error';
	} catch (error) {
		return error instanceof AppError ? error.code : 'sin error';
	}
}
