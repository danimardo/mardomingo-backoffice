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
	it('con la contraseña correcta envía el enlace de 24 h a la dirección nueva', async () => {
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

	it('una dirección de otra cuenta responde igual que una libre, sin email (CA3)', async () => {
		await f.accounts.register(registration({ email: 'ocupada@ejemplo.es' }));
		await f.accounts.verifyEmail(verificationTokenFor(f.mail, 'ocupada@ejemplo.es'));

		expect(await request({ newEmail: 'ocupada@ejemplo.es' })).toBe('sent');
		expect(
			f.mail.sent.some(
				(item) => item.to === 'ocupada@ejemplo.es' && item.text.includes('/email/confirmar')
			)
		).toBe(false);
	});

	it('aplicar el enlace cambia el email, cierra las sesiones, avisa a la anterior y no admite segundo uso', async () => {
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
				(item) => item.to === EMAIL && item.text.includes('se han cerrado todas las sesiones')
			)
		).toBe(true);
		expect(await f.accounts.confirmEmailChange(token)).toMatchObject({ outcome: 'invalid' });
	});

	it('un enlace caducado a las 24 h responde expired y no cambia el email', async () => {
		await request();
		const token = changeTokenFrom(NEW_EMAIL);
		f.database.db
			.update(verification)
			.set({ expiresAt: new Date(Date.now() - 1000) })
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
});
