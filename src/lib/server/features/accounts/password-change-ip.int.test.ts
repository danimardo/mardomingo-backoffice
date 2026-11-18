// C-35 (T427): la IP de la sesión creada al cambiar la contraseña es la real, no la de una cabecera del cliente.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	EMAIL,
	PASSWORD,
	accountsFixture,
	type AccountsFixture
} from '../../../../../tests/builders/accounts';
import { verifiedAccount } from '../../../../../tests/builders/app-session';
import { session } from './schema';

const SPOOFED_IP = '6.6.6.6';

let fixture: AccountsFixture;

beforeEach(() => {
	fixture = accountsFixture();
});

afterEach(() => {
	fixture.close();
});

async function webCookie(): Promise<string> {
	const web = await fixture.accounts.auth.api.signInEmail({
		body: { email: EMAIL, password: PASSWORD },
		headers: new Headers(),
		returnHeaders: true
	});
	return web.headers
		.getSetCookie()
		.map((item) => item.split(';')[0] ?? '')
		.join('; ');
}

describe('[C-35] IP de la sesión creada al cambiar la contraseña', () => {
	it('no toma la IP de una cabecera x-mm-client-ip enviada por el cliente', async () => {
		await verifiedAccount(fixture);
		const cookie = await webCookie();

		const outcome = await fixture.accounts.changePassword(
			new Headers({ cookie, 'x-mm-client-ip': SPOOFED_IP }),
			{ currentPassword: PASSWORD, newPassword: 'contraseña-nueva-de-prueba-456' }
		);

		expect(outcome).toBe('changed');
		const sessions = fixture.database.db.select().from(session).all();
		expect(sessions).toHaveLength(1);
		expect(sessions[0]?.ipAddress).not.toBe(SPOOFED_IP);
	});

	it('la sesión nueva guarda la IP real que pasa la ruta', async () => {
		await verifiedAccount(fixture);
		const cookie = await webCookie();

		const outcome = await fixture.accounts.changePassword(
			new Headers({ cookie, 'x-mm-client-ip': SPOOFED_IP }),
			{
				currentPassword: PASSWORD,
				newPassword: 'contraseña-nueva-de-prueba-456',
				remoteIp: '203.0.113.9'
			}
		);

		expect(outcome).toBe('changed');
		const sessions = fixture.database.db.select().from(session).all();
		expect(sessions[0]?.ipAddress).toBe('203.0.113.9');
	});
});
