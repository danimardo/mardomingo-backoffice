// C-27 (T419): carrera entre el login y una revocación concurrente. Better Auth lee la credencial, espera el hash de la
// contraseña de forma asíncrona y crea la sesión sin volver a leerla; si mientras tanto se borra la cuenta, se cambia la
// contraseña o se cambia el email (operaciones que cierran las sesiones), la sesión que crea el login al final no debe quedar
// válida. Defensa en profundidad: la lectura de la sesión trata como sin sesión la de una cuenta borrada o bloqueada.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	EMAIL,
	PASSWORD,
	accountsFixture,
	codeOf,
	type AccountsFixture
} from '../../../../../tests/builders/accounts';
import { appLogin, bearer, verifiedAccount } from '../../../../../tests/builders/app-session';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import { normalizeEmail } from './domain/email';
import { hashNormalizedEmail } from './email-hash';
import { loginAttempts, session, user } from './schema';

let fixture: AccountsFixture;

beforeEach(() => {
	fixture = accountsFixture();
});

afterEach(() => {
	fixture.close();
});

function userIdOf(email: string): string {
	const row = fixture.database.db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.email, email))
		.get();
	if (row === undefined) throw new Error('sin usuario');
	return row.id;
}

function sessionTokensOf(userId: string): string[] {
	return fixture.database.db
		.select({ token: session.token })
		.from(session)
		.where(eq(session.userId, userId))
		.all()
		.map((row) => row.token);
}

/** Fallos contados en el contador del login de ese email (BE-FR-67), o `null` si no hay contador. */
function loginFailuresOf(email: string): number | null {
	const key = hashNormalizedEmail(normalizeEmail(email), fixture.config.emailHashKey);
	const row = fixture.database.db
		.select({ failures: loginAttempts.failures })
		.from(loginAttempts)
		.where(eq(loginAttempts.emailNormalizedHash, key))
		.get();
	return row?.failures ?? null;
}

/**
 * «Puerta» de un solo uso en `password.verify` del contexto de Better Auth: la primera verificación hace el hash real y
 * después espera hasta `release()`. Las siguientes (p. ej. la del cambio de contraseña) pasan directamente. `entered` se
 * resuelve cuando el login ya ha verificado la contraseña y está a punto de crear la sesión.
 */
async function gatePasswordVerify() {
	const context = await fixture.accounts.auth.$context;
	const original = context.password.verify;
	let release!: () => void;
	let signalEntered!: () => void;
	const gate = new Promise<void>((resolve) => (release = resolve));
	const entered = new Promise<void>((resolve) => (signalEntered = resolve));
	let used = false;
	context.password.verify = async (input) => {
		if (used) return original(input);
		used = true;
		const ok = await original(input);
		signalEntered();
		await gate;
		return ok;
	};
	return {
		entered,
		release,
		restore: () => {
			context.password.verify = original;
		}
	};
}

/**
 * Lanza un login de app, lo detiene con la contraseña ya verificada, ejecuta la revocación y lo deja terminar. Devuelve el
 * código de error del login («sin error» si entró).
 */
async function loginRacing(revoke: () => Promise<void> | void) {
	const gate = await gatePasswordVerify();
	const login = codeOf(() => fixture.accounts.loginFromApp(appLogin()));
	await gate.entered;
	gate.restore();
	await revoke();
	gate.release();
	return login;
}

describe('[C-27] login concurrente con una revocación', () => {
	it('[C-27] [BE-FR-07] [BE-FR-06] un login en curso cuando se borra la cuenta no deja una sesión válida', async () => {
		await verifiedAccount(fixture);
		const userId = userIdOf(EMAIL);

		const code = await loginRacing(() => {
			// Borrado de cuenta (lo que hace `privacy` dentro de su transacción).
			fixture.accounts.revokeAllSessions(userId);
			expect(fixture.accounts.anonymizeUser(userId)).toBe(true);
		});

		expect(sessionTokensOf(userId)).toEqual([]);
		// Como una contraseña errónea: la cuenta ya no existe (BE-FR-67 CA1, el intento cuenta exista o no la cuenta).
		expect(code).toBe('INVALID_CREDENTIALS');
		expect(loginFailuresOf(EMAIL)).toBe(1);
		expect(eventsNamed(fixture.logger, 'accounts.login.succeeded')).toEqual([]);
		expect(eventsNamed(fixture.logger, 'accounts.login.failed').map((item) => item.fields)).toEqual(
			[{ reason: 'invalid_credentials', errorCode: 'INVALID_CREDENTIALS' }]
		);
	});

	it('[C-27] [BE-FR-04/CA2] un login en curso con la contraseña antigua no sobrevive al cambio de contraseña', async () => {
		await verifiedAccount(fixture);
		const userId = userIdOf(EMAIL);
		// Sesión web previa para cambiar la contraseña (se crea antes de poner la puerta).
		const web = await fixture.accounts.auth.api.signInEmail({
			body: { email: EMAIL, password: PASSWORD },
			headers: new Headers()
		});
		let afterChange: string[] = [];

		const code = await loginRacing(async () => {
			expect(
				await fixture.accounts.changePassword(bearer(web.token), {
					currentPassword: PASSWORD,
					newPassword: 'otra-contraseña-larga-456'
				})
			).toBe('changed');
			// Better Auth (`revokeOtherSessions`) borra todas las sesiones y abre una nueva para quien cambió la contraseña.
			afterChange = sessionTokensOf(userId);
		});

		expect(afterChange).toHaveLength(1);
		expect(afterChange).not.toContain(web.token);
		// Solo queda la sesión abierta por el cambio: la del login en curso no existe.
		expect(sessionTokensOf(userId)).toEqual(afterChange);
		expect(code).toBe('INVALID_CREDENTIALS');
	});

	it('[C-27] [BE-FR-66/CA5] un login en curso con el email anterior no sobrevive al cambio de email', async () => {
		await verifiedAccount(fixture);
		const userId = userIdOf(EMAIL);
		const newEmail = 'nueva@ejemplo.es';
		expect(
			await fixture.accounts.requestEmailChange({
				userId,
				currentPassword: PASSWORD,
				newEmail,
				remoteIp: null
			})
		).toBe('sent');
		const link = fixture.mail.sent.find((item) => item.to === newEmail)?.text ?? '';
		const token = decodeURIComponent(/token=([^\s&]+)/.exec(link)?.[1] ?? '');

		const code = await loginRacing(async () => {
			expect(await fixture.accounts.confirmEmailChange(token)).toMatchObject({
				outcome: 'applied'
			});
		});

		expect(sessionTokensOf(userId)).toEqual([]);
		expect(code).toBe('INVALID_CREDENTIALS');
	});

	it('[C-27] [BE-FR-03] sin revocación concurrente, el login con la puerta entra y su sesión es válida', async () => {
		await verifiedAccount(fixture);
		const userId = userIdOf(EMAIL);
		// La verificación del email ya abre una sesión web (W09); se cuentan solo las nuevas.
		const before = sessionTokensOf(userId);

		const code = await loginRacing(() => undefined);

		expect(code).toBe('sin error');
		expect(sessionTokensOf(userId).filter((token) => !before.includes(token))).toHaveLength(1);
		expect(loginFailuresOf(EMAIL)).toBeNull();
	});
});

describe('[C-27] lectura de sesión de una cuenta borrada o bloqueada (defensa en profundidad)', () => {
	async function appSession(): Promise<{ readonly userId: string; readonly token: string }> {
		await verifiedAccount(fixture);
		const { token } = await fixture.accounts.loginFromApp(appLogin());
		expect(await fixture.accounts.readSession(bearer(token))).not.toBeNull();
		return { userId: userIdOf(EMAIL), token };
	}

	it('[C-27] [BE-FR-07] una sesión que siga en la base de una cuenta ya anonimizada no autentica', async () => {
		const { userId, token } = await appSession();
		// Sin `revokeAllSessions`: simula una sesión que hubiera escapado al cierre del borrado.
		expect(fixture.accounts.anonymizeUser(userId)).toBe(true);
		expect(sessionTokensOf(userId)).toContain(token);

		expect(await fixture.accounts.readSession(bearer(token))).toBeNull();
	});

	it('[C-27] [BE-FR-28] una sesión que siga en la base de una cuenta bloqueada no autentica', async () => {
		const { userId, token } = await appSession();
		// Sin cerrar sesiones: simula una sesión que hubiera escapado al cierre del bloqueo.
		fixture.database.db.update(user).set({ banned: true }).where(eq(user.id, userId)).run();
		expect(sessionTokensOf(userId)).toContain(token);

		expect(await fixture.accounts.readSession(bearer(token))).toBeNull();
	});
});
