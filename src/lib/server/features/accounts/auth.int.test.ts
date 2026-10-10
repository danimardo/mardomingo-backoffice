// Better Auth 1.7.7 sobre SQLite real (T094; R02): alta, verificación por token, login solo tras verificar, sesión
// opaca y cierre. Los envíos de email son falsos: se guarda el token que el servicio tendría que enviar.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyOfTemplate, type TestDatabase } from '../../../../../tests/builders/database';
import { createAuth, type Auth } from './auth';
import { session, user } from './schema';

interface SentToken {
	readonly kind: 'verification' | 'reset';
	readonly email: string;
	readonly userId: string;
	readonly token: string;
}

let database: TestDatabase | undefined;
let auth: Auth;
let sent: SentToken[];
let verified: string[];

beforeEach(() => {
	database = copyOfTemplate();
	sent = [];
	verified = [];
	auth = createAuth({
		db: database.db,
		secret: 'secreto-de-prueba-de-al-menos-32-caracteres',
		baseUrl: 'https://cuenta.mardomingo.test',
		sendVerification: (email, userId, token) => {
			sent.push({ kind: 'verification', email, userId, token });
			return Promise.resolve();
		},
		sendPasswordReset: (email, userId, token) => {
			sent.push({ kind: 'reset', email, userId, token });
			return Promise.resolve();
		},
		onEmailVerified: (userId) => {
			verified.push(userId);
		}
	});
});

afterEach(() => {
	database?.dispose();
	database = undefined;
});

const EMAIL = 'juan@ejemplo.es';
const PASSWORD = 'contraseña-larga';

async function register(): Promise<void> {
	await auth.api.signUpEmail({ body: { email: EMAIL, password: PASSWORD, name: '' } });
}

async function rejectionOf(action: () => Promise<unknown>): Promise<string> {
	try {
		await action();
		return 'sin error';
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
}

/** Tokens de sesión que hay ahora mismo en la base de datos. */
function sessionTokens(): string[] {
	return (database?.db.select().from(session).all() ?? []).map((row) => row.token);
}

describe('Better Auth con SQLite real', () => {
	it('el alta crea una cuenta sin verificar con nombre vacío', async () => {
		await register();

		const row = database?.db.select().from(user).where(eq(user.email, EMAIL)).get();
		expect(row).toMatchObject({ name: '', emailVerified: false, role: 'user' });
	});

	it('el email de verificación lleva un token que se puede usar una vez', async () => {
		await register();
		await auth.api.sendVerificationEmail({ body: { email: EMAIL } });

		const [mail] = sent;
		expect(mail?.kind).toBe('verification');
		await auth.api.verifyEmail({ query: { token: mail?.token ?? '' } });

		expect(verified).toHaveLength(1);
		const row = database?.db.select().from(user).where(eq(user.email, EMAIL)).get();
		expect(row?.emailVerified).toBe(true);
		// Better Auth no falla con un token repetido (el token es un JWT sin estado): responde sin usuario. El servicio
		// lo lee como «ya usado» (TOKEN_USED); aquí solo se comprueba que no vuelve a ejecutar los efectos.
		const reused: unknown = await auth.api.verifyEmail({ query: { token: mail?.token ?? '' } });
		expect(reused).toMatchObject({ user: null });
		expect(verified).toHaveLength(1);
	});

	it('sin verificar no se puede iniciar sesión; verificada, sí', async () => {
		await register();
		expect(
			await rejectionOf(() => auth.api.signInEmail({ body: { email: EMAIL, password: PASSWORD } }))
		).not.toBe('sin error');

		await auth.api.sendVerificationEmail({ body: { email: EMAIL } });
		await auth.api.verifyEmail({ query: { token: sent[0]?.token ?? '' } });
		const login = await auth.api.signInEmail({ body: { email: EMAIL, password: PASSWORD } });

		expect(login.user.email).toBe(EMAIL);
		expect(sessionTokens()).toContain(login.token);
	});

	it('cerrar sesión borra la sesión de esa petición y deja las demás', async () => {
		await register();
		await auth.api.sendVerificationEmail({ body: { email: EMAIL } });
		await auth.api.verifyEmail({ query: { token: sent[0]?.token ?? '' } });
		const login = await auth.api.signInEmail({
			body: { email: EMAIL, password: PASSWORD },
			headers: new Headers()
		});
		const before = sessionTokens();
		const headers = new Headers({ authorization: `Bearer ${login.token}` });

		await auth.api.signOut({ headers });

		const after = sessionTokens();
		expect(after).not.toContain(login.token);
		expect(after).toHaveLength(before.length - 1);
	});

	it('la recuperación envía un token de un solo uso y cambia la contraseña', async () => {
		await register();
		await auth.api.sendVerificationEmail({ body: { email: EMAIL } });
		await auth.api.verifyEmail({ query: { token: sent[0]?.token ?? '' } });
		await auth.api.requestPasswordReset({ body: { email: EMAIL } });

		const reset = sent.find((item) => item.kind === 'reset');
		expect(reset).toBeDefined();
		await auth.api.resetPassword({
			body: { newPassword: 'nueva-contraseña-123', token: reset?.token ?? '' }
		});

		const login = await auth.api.signInEmail({
			body: { email: EMAIL, password: 'nueva-contraseña-123' }
		});
		expect(login.user.email).toBe(EMAIL);
	});
});
