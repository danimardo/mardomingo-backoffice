// Cambio de email contra SQLite real (T265; BE-FR-66/CA1–CA5, BE-FR-45): pedir con contraseña, respuesta neutra si la dirección
// es de otra cuenta, aplicar desde el enlace (un solo uso), caducidad a las 24 h, cierre de sesiones y límite por IP.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	accountsFixture,
	codeOf,
	EMAIL,
	PASSWORD,
	registration,
	verificationTokenFor,
	type AccountsFixture
} from '../../../../../tests/builders/accounts';
import { session, user, verification } from './schema';
import { EMAIL_CHANGE_PER_IP_HOUR } from './email-change';

const NEW_EMAIL = 'nueva@ejemplo.es';
const IP = '203.0.113.7';
let f: AccountsFixture;
let userId: string;

function changeTokenFrom(address: string): string {
	const sent = f.mail.sent.filter(
		(item) => item.to === address && item.text.includes('/email/confirmar?token=')
	);
	const last = sent[sent.length - 1];
	const match = /token=([^\s&]+)/.exec(last?.text ?? '');
	if (match?.[1] === undefined) throw new Error('no hay enlace de cambio de email');
	return decodeURIComponent(match[1]);
}

beforeEach(async () => {
	f = accountsFixture();
	await f.accounts.register(registration());
	await f.accounts.verifyEmail(verificationTokenFor(f.mail, EMAIL));
	const row = f.database.db.select({ id: user.id }).from(user).where(eq(user.email, EMAIL)).get();
	if (row === undefined) throw new Error('la cuenta debía existir');
	userId = row.id;
});

afterEach(() => {
	f.close();
});

const request = (
	overrides: Partial<{ currentPassword: string; newEmail: string; remoteIp: string | null }> = {}
) =>
	f.accounts.requestEmailChange({
		userId,
		currentPassword: PASSWORD,
		newEmail: NEW_EMAIL,
		remoteIp: IP,
		...overrides
	});

describe('cambio de email (T265)', () => {
	it('[BE-FR-66/CA1] con la contraseña correcta envía el enlace de 24 h a la dirección nueva', async () => {
		expect(await request()).toBe('sent');

		const sent = f.mail.sent.find((item) => item.to === NEW_EMAIL);
		expect(sent?.text).toContain('/email/confirmar?token=');
		const pending = f.database.db.select().from(verification).all();
		expect(pending.filter((row) => row.identifier.startsWith('email-change:'))).toHaveLength(1);
	});

	it('con una contraseña errónea responde wrong_password y no envía nada', async () => {
		expect(await request({ currentPassword: 'otra-contraseña-123' })).toBe('wrong_password');
		expect(f.mail.sent.some((item) => item.to === NEW_EMAIL)).toBe(false);
	});

	it('[BE-FR-66/CA3] una dirección de otra cuenta responde igual que una libre, sin email (CA3)', async () => {
		await f.accounts.register(registration({ email: 'ocupada@ejemplo.es' }));
		await f.accounts.verifyEmail(verificationTokenFor(f.mail, 'ocupada@ejemplo.es'));

		expect(await request({ newEmail: 'ocupada@ejemplo.es' })).toBe('sent');
		expect(
			f.mail.sent.some(
				(item) => item.to === 'ocupada@ejemplo.es' && item.text.includes('/email/confirmar')
			)
		).toBe(false);
	});

	it('[BE-FR-66/CA1] [BE-FR-66/CA2] [BE-FR-66/CA5] aplicar el enlace cambia el email, cierra las sesiones, avisa a la anterior y no admite segundo uso', async () => {
		await request();
		const token = changeTokenFrom(NEW_EMAIL);

		const outcome = await f.accounts.confirmEmailChange(token);
		expect(outcome).toMatchObject({ outcome: 'applied' });
		const row = f.database.db
			.select({ email: user.email, normalized: user.emailNormalized })
			.from(user)
			.where(eq(user.id, userId))
			.get();
		expect(row).toMatchObject({ email: NEW_EMAIL, normalized: NEW_EMAIL });
		expect(
			f.database.db.select().from(session).where(eq(session.userId, userId)).all()
		).toHaveLength(0);
		expect(
			f.mail.sent.some(
				(item) => item.to === EMAIL && item.text.includes('se han cerrado las demás sesiones')
			)
		).toBe(true);
		expect(await f.accounts.confirmEmailChange(token)).toMatchObject({ outcome: 'invalid' });
	});

	it('[BE-FR-66/CA4] el cambio recalcula email_normalized con la regla de gmail (sin puntos ni +etiqueta)', async () => {
		const gmail = 'juan.perez+compras@gmail.com';
		await request({ newEmail: gmail });
		const token = changeTokenFrom(gmail);

		await f.accounts.confirmEmailChange(token);
		const row = f.database.db
			.select({ email: user.email, normalized: user.emailNormalized })
			.from(user)
			.where(eq(user.id, userId))
			.get();
		expect(row).toMatchObject({ email: gmail, normalized: 'juanperez@gmail.com' });
	});

	it('un enlace caducado a las 24 h responde expired y no cambia el email', async () => {
		await request();
		const token = changeTokenFrom(NEW_EMAIL);
		f.database.db
			.update(verification)
			.set({ expiresAt: new Date(0) })
			.run();

		expect(await f.accounts.confirmEmailChange(token)).toMatchObject({ outcome: 'expired' });
		const row = f.database.db
			.select({ email: user.email })
			.from(user)
			.where(eq(user.id, userId))
			.get();
		expect(row?.email).toBe(EMAIL);
	});

	it(`el límite por IP (${String(EMAIL_CHANGE_PER_IP_HOUR)} por hora) responde RATE_LIMITED`, async () => {
		for (let attempt = 0; attempt < EMAIL_CHANGE_PER_IP_HOUR; attempt += 1) {
			await request({ newEmail: `alias${String(attempt)}@ejemplo.es` });
		}

		expect(await codeOf(() => request({ newEmail: 'otra@ejemplo.es' }))).toBe('RATE_LIMITED');
	});

	it('[C-15] pedir el cambio avisa a la dirección ACTUAL, con el motivo y sin enlace', async () => {
		await request();

		const notices = f.mail.sent.filter(
			(item) =>
				item.to === EMAIL && item.subject === 'Alguien ha pedido cambiar el email de tu cuenta'
		);
		expect(notices).toHaveLength(1);
		expect(notices[0]?.text).not.toContain('/email/confirmar');
		expect(notices[0]?.text).not.toContain(NEW_EMAIL);
	});

	it('[C-15] una petición con contraseña errónea o con dirección ocupada no avisa a la actual', async () => {
		await request({ currentPassword: 'otra-contraseña-123' });
		await f.accounts.register(registration({ email: 'ocupada@ejemplo.es' }));
		await f.accounts.verifyEmail(verificationTokenFor(f.mail, 'ocupada@ejemplo.es'));
		await request({ newEmail: 'ocupada@ejemplo.es' });

		expect(
			f.mail.sent.some(
				(item) =>
					item.to === EMAIL && item.subject === 'Alguien ha pedido cambiar el email de tu cuenta'
			)
		).toBe(false);
	});
});

describe('forma normalizada de la propia cuenta (C-23)', () => {
	const TAGGED = 'pepe+trabajo@ejemplo.es';
	const PLAIN = 'pepe@ejemplo.es';

	async function accountWithTaggedEmail(): Promise<string> {
		await f.accounts.register(registration({ email: TAGGED }));
		await f.accounts.verifyEmail(verificationTokenFor(f.mail, TAGGED));
		const row = f.database.db
			.select({ id: user.id })
			.from(user)
			.where(eq(user.email, TAGGED))
			.get();
		if (row === undefined) throw new Error('la cuenta debía existir');
		return row.id;
	}

	it('[BE-FR-66/CA3] pasar de pepe+trabajo@ a pepe@ (libre) envía el enlace y al confirmarlo cambia el email', async () => {
		const id = await accountWithTaggedEmail();

		const outcome = await f.accounts.requestEmailChange({
			userId: id,
			currentPassword: PASSWORD,
			newEmail: PLAIN,
			remoteIp: null
		});
		await f.accounts.drainEmails();

		expect(outcome).toBe('sent');
		expect(await f.accounts.confirmEmailChange(changeTokenFrom(PLAIN))).toMatchObject({
			outcome: 'applied'
		});
		expect(
			f.database.db
				.select({ email: user.email, normalized: user.emailNormalized })
				.from(user)
				.where(eq(user.id, id))
				.get()
		).toEqual({ email: PLAIN, normalized: PLAIN });
	});

	it('la misma dirección exacta se sigue suprimiendo: responde sent y no envía nada', async () => {
		const id = await accountWithTaggedEmail();
		const before = f.mail.sent.length;

		const outcome = await f.accounts.requestEmailChange({
			userId: id,
			currentPassword: PASSWORD,
			newEmail: TAGGED.toUpperCase(),
			remoteIp: null
		});
		await f.accounts.drainEmails();

		expect(outcome).toBe('sent');
		expect(f.mail.sent).toHaveLength(before);
	});
});

describe('sesión actual al aplicar el cambio (C-19; W14)', () => {
	function sessionIds(): string[] {
		return f.database.db
			.select({ id: session.id })
			.from(session)
			.where(eq(session.userId, userId))
			.all()
			.map((row) => row.id);
	}

	async function openSecondSession(): Promise<void> {
		await f.accounts.auth.api.signInEmail({
			body: { email: EMAIL, password: PASSWORD },
			headers: new Headers()
		});
	}

	it('[BE-FR-66/CA5] conserva la sesión actual y revoca las demás', async () => {
		await openSecondSession();
		const [current, other] = sessionIds();
		expect(other).toBeDefined();
		await request();

		const outcome = await f.accounts.confirmEmailChange(changeTokenFrom(NEW_EMAIL), current);

		expect(outcome).toEqual({ outcome: 'applied', sessionsClosed: 1, sessionKept: true });
		expect(sessionIds()).toEqual([current]);
	});

	it('una sesión de otra cuenta no se conserva ni se toca: la cuenta del cambio queda sin sesiones', async () => {
		await f.accounts.register(registration({ email: 'otra@ejemplo.es' }));
		await f.accounts.verifyEmail(verificationTokenFor(f.mail, 'otra@ejemplo.es'));
		const foreign = f.database.db
			.select({ id: session.id })
			.from(session)
			.innerJoin(user, eq(user.id, session.userId))
			.where(eq(user.email, 'otra@ejemplo.es'))
			.get();
		await request();

		const outcome = await f.accounts.confirmEmailChange(changeTokenFrom(NEW_EMAIL), foreign?.id);

		expect(outcome).toMatchObject({ outcome: 'applied', sessionKept: false });
		expect(sessionIds()).toEqual([]);
		expect(
			f.database.db
				.select()
				.from(session)
				.where(eq(session.id, foreign?.id ?? ''))
				.get()
		).toBeDefined();
	});
});

describe('tokens pendientes frente a cambios de credenciales (C-15, C-20)', () => {
	async function webCookie(password: string): Promise<string> {
		const web = await f.accounts.auth.api.signInEmail({
			body: { email: EMAIL, password },
			headers: new Headers(),
			returnHeaders: true
		});
		return web.headers
			.getSetCookie()
			.map((item) => item.split(';')[0] ?? '')
			.join('; ');
	}

	function resetTokenFrom(address: string): string {
		const sent = f.mail.sent.filter(
			(item) => item.to === address && item.text.includes('/recuperar/nueva?token=')
		);
		const match = /token=([^\s&]+)/.exec(sent.at(-1)?.text ?? '');
		if (match?.[1] === undefined) throw new Error('no hay enlace de recuperación');
		return decodeURIComponent(match[1]);
	}

	it('[BE-FR-05] [BE-FR-66/CA6] cambiar la contraseña anula el cambio de email pedido', async () => {
		await request();
		const token = changeTokenFrom(NEW_EMAIL);
		const cookie = await webCookie(PASSWORD);

		expect(
			await f.accounts.changePassword(new Headers({ cookie }), {
				currentPassword: PASSWORD,
				newPassword: 'contraseña-nueva-456789'
			})
		).toBe('changed');

		expect(await f.accounts.confirmEmailChange(token)).toMatchObject({ outcome: 'invalid' });
		const row = f.database.db
			.select({ email: user.email })
			.from(user)
			.where(eq(user.id, userId))
			.get();
		expect(row?.email).toBe(EMAIL);
	});

	it('[BE-FR-05] [BE-FR-66/CA6] recuperar la contraseña anula el cambio de email pedido', async () => {
		await request();
		const token = changeTokenFrom(NEW_EMAIL);
		await f.accounts.requestPasswordReset({ email: EMAIL, remoteIp: null });

		await f.accounts.resetPassword({
			token: resetTokenFrom(EMAIL),
			password: 'contraseña-recuperada-1'
		});

		expect(await f.accounts.confirmEmailChange(token)).toMatchObject({ outcome: 'invalid' });
		const row = f.database.db
			.select({ email: user.email })
			.from(user)
			.where(eq(user.id, userId))
			.get();
		expect(row?.email).toBe(EMAIL);
	});

	it('[BE-FR-66/CA6] aplicar el cambio de email anula los enlaces de recuperación pendientes', async () => {
		await f.accounts.requestPasswordReset({ email: EMAIL, remoteIp: null });
		const resetToken = resetTokenFrom(EMAIL);
		await request();

		expect(await f.accounts.confirmEmailChange(changeTokenFrom(NEW_EMAIL))).toMatchObject({
			outcome: 'applied'
		});

		expect(f.accounts.tokenState(resetToken, 'reset')).toBe('invalid');
		expect(
			await codeOf(() =>
				f.accounts.resetPassword({ token: resetToken, password: 'contraseña-del-atacante-1' })
			)
		).toBe('TOKEN_INVALID');
	});

	it('los cambios de email pendientes de otra cuenta no se tocan', async () => {
		await f.accounts.register(registration({ email: 'otra@ejemplo.es' }));
		await f.accounts.verifyEmail(verificationTokenFor(f.mail, 'otra@ejemplo.es'));
		const other = f.database.db
			.select({ id: user.id })
			.from(user)
			.where(eq(user.email, 'otra@ejemplo.es'))
			.get();
		await f.accounts.requestEmailChange({
			userId: other?.id ?? '',
			currentPassword: PASSWORD,
			newEmail: 'otra-nueva@ejemplo.es',
			remoteIp: null
		});
		await request();
		await f.accounts.requestPasswordReset({ email: EMAIL, remoteIp: null });

		await f.accounts.resetPassword({
			token: resetTokenFrom(EMAIL),
			password: 'contraseña-recuperada-1'
		});

		expect(
			await f.accounts.confirmEmailChange(changeTokenFrom('otra-nueva@ejemplo.es'))
		).toMatchObject({ outcome: 'applied' });
	});
});
