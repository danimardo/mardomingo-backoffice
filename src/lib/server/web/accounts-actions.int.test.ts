// Acciones de cuenta de W08, W11, W12 y W15 (T109; BE-FR-01, 03, 05, 06, 67) contra la composición real y SQLite.
// Las acciones de ruta (`actions.registrar`, `actions.entrar`, `actions.solicitar`, `actions.salir`) no se llaman desde
// aquí: su `RequestEvent` exige `tracing`, cuyo tipo `Span` viene de `@opentelemetry/api`, que no es dependencia del
// proyecto (ver `tests/builders/request-event.ts`). Se prueba lo que cada acción hace antes y después de ese evento:
// la validación del formulario (`parseForm` con el esquema de la ruta) y la llamada al servicio `accounts` real.
// El registro no se llama aquí: el captcha iría a Turnstile por red (la composición no admite un verificador falso).
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashPassword } from 'better-auth/crypto';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	createFakeLogger,
	eventsNamed,
	type FakeLogger
} from '../../../../tests/builders/fake-logger';
import { TEMPLATE_DB } from '../../../../tests/setup/integration.global-setup';
import { parseEnv } from '$lib/server/config/env-schema';
import { createComposition, type Composition } from '$lib/server/composition';
import { account, user } from '$lib/server/features/accounts/schema';
import { RequestResetSchema } from '$lib/schemas/accounts/password-reset';
import { LoginSchema } from '$lib/schemas/accounts/login';
import { REGISTER_CHECKBOXES, RegisterSchema } from '$lib/schemas/accounts/register';
import { parseForm } from '$lib/server/forms';
import { AppError } from '$lib/server/shared/errors';

const PASSWORD = 'contraseña-acciones-123';
let composition: Composition;
let logger: FakeLogger;
let dir: string;

/** Inserta una cuenta con contraseña, verificada o no y bloqueada o no, en la base de la composición. */
async function createAccount(
	email: string,
	state: { readonly verified: boolean; readonly banned: boolean }
): Promise<void> {
	const id = `usr_${randomUUID().slice(0, 8)}`;
	composition.db
		.insert(user)
		.values({
			id,
			name: '',
			email,
			emailNormalized: email,
			emailVerified: state.verified,
			banned: state.banned,
			role: 'user'
		})
		.run();
	composition.db
		.insert(account)
		.values({
			id: `acc_${id}`,
			userId: id,
			accountId: id,
			providerId: 'credential',
			password: await hashPassword(PASSWORD)
		})
		.run();
}

/** Código del error de negocio que lanza una promesa, o `undefined` si no lanza uno. */
async function errorCodeOf(promise: Promise<unknown>): Promise<string | undefined> {
	try {
		await promise;
		return undefined;
	} catch (error) {
		return error instanceof AppError ? error.code : undefined;
	}
}

/** Formulario como lo envía el navegador: los campos vacíos o ausentes no se incluyen. */
function formOf(fields: Record<string, string | undefined>): FormData {
	const form = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		if (value !== undefined) form.set(key, value);
	}
	return form;
}

beforeAll(() => {
	dir = mkdtempSync(join(tmpdir(), 'mdm-acciones-cuenta-'));
	const path = join(dir, 'app.db');
	copyFileSync(TEMPLATE_DB, path);
	const config = parseEnv({
		APP_ENV: 'test',
		PUBLIC_API_URL: 'http://127.0.0.1:7312',
		PUBLIC_WEB_URL: 'http://localhost:7312',
		BETTER_AUTH_URL: 'http://localhost:7312',
		DATABASE_PATH: path,
		BETTER_AUTH_SECRET: 'a'.repeat(32),
		EMAIL_HASH_KEY: 'b'.repeat(32)
	});
	logger = createFakeLogger();
	composition = createComposition(config, logger);
});

afterAll(() => {
	composition.close();
	rmSync(dir, { recursive: true, force: true });
});

describe('formulario de W11 (login) antes del servicio', () => {
	it('sin contraseña falla con el error del campo y no devuelve la contraseña en los valores', () => {
		const parsed = parseForm(
			LoginSchema,
			formOf({ email: 'ana@ejemplo.es', redirectTo: '/panel' })
		);

		expect(parsed.ok).toBe(false);
		if (parsed.ok) throw new Error('sin contraseña no debía validar');
		expect(parsed.failure.status).toBe(400);
		expect(parsed.failure.data.errors).toHaveProperty('password');
		expect(parsed.failure.data.values).not.toHaveProperty('password');
		expect(parsed.failure.data.values).toMatchObject({ email: 'ana@ejemplo.es' });
	});

	it('con un email mal formado falla en el campo email', () => {
		const parsed = parseForm(LoginSchema, formOf({ email: 'no-es-un-email', password: PASSWORD }));

		expect(parsed.ok).toBe(false);
		if (parsed.ok) throw new Error('un email mal formado no debía validar');
		expect(parsed.failure.data.errors).toHaveProperty('email');
		expect(parsed.failure.data.values).not.toHaveProperty('password');
	});
});

describe('formulario de W08 (registro) antes del servicio', () => {
	const complete = {
		email: 'nueva.persona@ejemplo.es',
		password: 'contraseña-registro-123',
		acceptTerms: 'on',
		acceptPrivacy: 'on',
		acceptAup: 'on',
		ageDeclaration: 'on',
		versionTerms: '2026-10-11',
		versionPrivacy: '2026-10-11',
		versionAup: '2026-10-11'
	};

	it('sin una de las cuatro aceptaciones no pasa la validación', () => {
		const parsed = parseForm(RegisterSchema, formOf({ ...complete, acceptAup: undefined }), {
			booleans: REGISTER_CHECKBOXES
		});

		expect(parsed.ok).toBe(false);
		if (parsed.ok) throw new Error('sin la aceptación de la AUP no debía validar');
		expect(parsed.failure.status).toBe(400);
		expect(parsed.failure.data.errors).toHaveProperty('acceptAup');
		expect(parsed.failure.data.values).not.toHaveProperty('password');
	});

	it('con todos los campos y las cuatro aceptaciones pasa la validación', () => {
		const parsed = parseForm(RegisterSchema, formOf(complete), {
			booleans: REGISTER_CHECKBOXES
		});

		expect(parsed.ok).toBe(true);
	});
});

describe('formulario de W12 (recuperar) antes del servicio', () => {
	it('un email mal formado falla antes de llegar al servicio', () => {
		const parsed = parseForm(RequestResetSchema, formOf({ email: 'sin-arroba' }));

		expect(parsed.ok).toBe(false);
		if (parsed.ok) throw new Error('un email mal formado no debía validar');
		expect(parsed.failure.data.errors).toHaveProperty('email');
	});
});

describe('login de W11 con el servicio accounts real', () => {
	it('cuenta verificada con la contraseña correcta devuelve el destino pedido', async () => {
		await createAccount('login.correcto@ejemplo.es', { verified: true, banned: false });

		const result = await composition.accounts.login({
			email: 'login.correcto@ejemplo.es',
			password: PASSWORD,
			redirectTo: '/panel/bienvenida',
			remoteIp: null
		});

		expect(result.redirectTo).toBe('/panel/bienvenida');
	});

	it('un destino externo se sustituye por el panel', async () => {
		await createAccount('login.destino@ejemplo.es', { verified: true, banned: false });

		const result = await composition.accounts.login({
			email: 'login.destino@ejemplo.es',
			password: PASSWORD,
			redirectTo: 'https://ejemplo.invalido/robo',
			remoteIp: null
		});

		expect(result.redirectTo).toBe('/panel');
	});

	it('contraseña incorrecta devuelve INVALID_CREDENTIALS', async () => {
		await createAccount('login.mala@ejemplo.es', { verified: true, banned: false });

		const code = await errorCodeOf(
			composition.accounts.login({
				email: 'login.mala@ejemplo.es',
				password: 'contraseña-equivocada-123',
				redirectTo: undefined,
				remoteIp: null
			})
		);

		expect(code).toBe('INVALID_CREDENTIALS');
	});

	it('cuenta sin verificar con la contraseña correcta devuelve EMAIL_NOT_VERIFIED', async () => {
		await createAccount('login.sin.verificar@ejemplo.es', { verified: false, banned: false });

		const code = await errorCodeOf(
			composition.accounts.login({
				email: 'login.sin.verificar@ejemplo.es',
				password: PASSWORD,
				redirectTo: undefined,
				remoteIp: null
			})
		);

		expect(code).toBe('EMAIL_NOT_VERIFIED');
	});

	it('cuenta bloqueada con la contraseña correcta devuelve ACCOUNT_BLOCKED', async () => {
		await createAccount('login.bloqueada@ejemplo.es', { verified: true, banned: true });

		const code = await errorCodeOf(
			composition.accounts.login({
				email: 'login.bloqueada@ejemplo.es',
				password: PASSWORD,
				redirectTo: undefined,
				remoteIp: null
			})
		);

		expect(code).toBe('ACCOUNT_BLOCKED');
	});
});

describe('recuperar de W12 con el servicio accounts real', () => {
	it('un email inexistente no falla y deja el evento como suprimido (antienumeración)', async () => {
		await expect(
			composition.accounts.requestPasswordReset({
				email: 'nadie.recupera@ejemplo.es',
				remoteIp: null
			})
		).resolves.toBeUndefined();

		const events = eventsNamed(logger, 'accounts.password.reset_requested');
		expect(events.at(-1)?.fields).toMatchObject({ status: 'suppressed' });
	});
});

describe('cierre de sesión de W15 con el servicio accounts real', () => {
	it('sin cookie de sesión no falla y registra el cierre', async () => {
		await expect(composition.accounts.logout(new Headers())).resolves.toBeUndefined();

		expect(eventsNamed(logger, 'accounts.session.revoked').at(-1)?.fields).toMatchObject({
			reason: 'logout'
		});
	});
});
