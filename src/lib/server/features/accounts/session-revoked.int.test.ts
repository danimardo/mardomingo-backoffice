// C-31 (T423): cada revocación de sesiones emite `accounts.session.revoked` con su motivo y el número real de sesiones borradas
// (contracts/log-events.md). `password.changed` y `email_change.applied` llevan `count`.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	EMAIL,
	PASSWORD,
	accountsFixture,
	type AccountsFixture
} from '../../../../../tests/builders/accounts';
import { appLogin, bearer, verifiedAccount } from '../../../../../tests/builders/app-session';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import { blockAccount } from './service';
import { session, user } from './schema';

let f: AccountsFixture;

beforeEach(() => {
	f = accountsFixture();
});

afterEach(() => {
	f.close();
});

function revoked(): object[] {
	return eventsNamed(f.logger, 'accounts.session.revoked').map((item) => item.fields);
}

async function webCookie(): Promise<string> {
	const web = await f.accounts.auth.api.signInEmail({
		body: { email: EMAIL, password: PASSWORD },
		headers: new Headers(),
		returnHeaders: true
	});
	return web.headers
		.getSetCookie()
		.map((item) => item.split(';')[0] ?? '')
		.join('; ');
}

function ownerId(): string {
	const row = f.database.db.select({ id: user.id }).from(user).where(eq(user.email, EMAIL)).get();
	if (row === undefined) throw new Error('la cuenta debía existir');
	return row.id;
}

// `verifiedAccount` deja una sesión abierta (Better Auth inicia sesión al verificar el email), por eso cada recuento suma una.
describe('[C-31] accounts.session.revoked', () => {
	it('cambiar la contraseña emite password_changed con el recuento real y count en password.changed', async () => {
		await verifiedAccount(f);
		const cookie = await webCookie();
		await f.accounts.loginFromApp(appLogin());

		await f.accounts.changePassword(new Headers({ cookie }), {
			currentPassword: PASSWORD,
			newPassword: 'contraseña-nueva-de-prueba-456'
		});

		expect(eventsNamed(f.logger, 'accounts.password.changed').map((i) => i.fields)).toEqual([
			{ count: 3 }
		]);
		expect(revoked()).toEqual([{ reason: 'password_changed', count: 3 }]);
	});

	it('recuperar la contraseña emite password_changed con las sesiones cerradas', async () => {
		await verifiedAccount(f);
		await f.accounts.loginFromApp(appLogin());
		await f.accounts.requestPasswordReset({ email: EMAIL, remoteIp: '203.0.113.7' });
		const link = f.mail.sent.find((item) => item.text.includes('/recuperar/nueva?token='));
		const token = decodeURIComponent(/token=([^\s&]+)/.exec(link?.text ?? '')?.[1] ?? '');

		await f.accounts.resetPassword({ token, password: 'nueva-contraseña-456' });

		const events = revoked();
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({ reason: 'password_changed' });
		expect(f.database.db.select().from(session).all()).toHaveLength(0);
	});

	it('aplicar el cambio de email emite email_changed y count en email_change.applied', async () => {
		await verifiedAccount(f);
		await f.accounts.loginFromApp(appLogin());
		await f.accounts.loginFromApp(appLogin());
		await f.accounts.requestEmailChange({
			userId: ownerId(),
			currentPassword: PASSWORD,
			newEmail: 'nueva@ejemplo.es',
			remoteIp: '203.0.113.7'
		});
		const sent = f.mail.sent.filter((item) => item.to === 'nueva@ejemplo.es').at(-1);
		const token = decodeURIComponent(/token=([^\s&]+)/.exec(sent?.text ?? '')?.[1] ?? '');

		await f.accounts.confirmEmailChange(token);

		expect(eventsNamed(f.logger, 'accounts.email_change.applied').map((i) => i.fields)).toEqual([
			{ count: 3 }
		]);
		expect(revoked()).toEqual([{ reason: 'email_changed', count: 3 }]);
	});

	it('logout emite logout con count 1', async () => {
		await verifiedAccount(f);
		const result = await f.accounts.loginFromApp(appLogin());

		await f.accounts.logout(bearer(result.token));

		expect(revoked()).toEqual([{ reason: 'logout', count: 1 }]);
	});

	it('el bloqueo por contracargo emite blocked con las sesiones cerradas', async () => {
		await verifiedAccount(f);
		await f.accounts.loginFromApp(appLogin());
		await f.accounts.loginFromApp(appLogin());
		await f.accounts.loginFromApp(appLogin());

		blockAccount(
			{ db: f.database.db, logger: f.logger },
			{ userId: ownerId(), reason: 'chargeback' }
		);

		expect(revoked()).toEqual([{ reason: 'blocked', count: 4 }]);
	});
});
