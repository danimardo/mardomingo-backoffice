// Reglas de sesión entre varios dispositivos contra SQLite real (BE-FR-04 CA3 y CA5; T109 de L03). Una cuenta puede tener
// varias sesiones a la vez, y cambiar la contraseña cierra todas menos la actual.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	EMAIL,
	PASSWORD,
	accountsFixture,
	type AccountsFixture
} from '../../../../../tests/builders/accounts';
import { appLogin, bearer, verifiedAccount } from '../../../../../tests/builders/app-session';
import { session } from './schema';

let fixture: AccountsFixture;

beforeEach(() => {
	fixture = accountsFixture();
});

afterEach(() => {
	fixture.close();
});

describe('sesiones de una misma cuenta (BE-FR-04)', () => {
	it('[BE-FR-04/CA5] una cuenta puede tener varias sesiones abiertas a la vez', async () => {
		await verifiedAccount(fixture);
		const first = await fixture.accounts.loginFromApp(appLogin());
		const second = await fixture.accounts.loginFromApp(appLogin());
		const third = await fixture.accounts.loginFromApp(appLogin());

		for (const result of [first, second, third]) {
			expect(await fixture.accounts.readSession(bearer(result.token))).not.toBeNull();
		}
	});

	it('[BE-FR-04/CA3] cambiar la contraseña cierra las demás sesiones y conserva la actual', async () => {
		await verifiedAccount(fixture);
		// La web (W27) cambia la contraseña con la cookie de sesión, no con Bearer: se entra por la web.
		const web = await fixture.accounts.auth.api.signInEmail({
			body: { email: EMAIL, password: PASSWORD },
			headers: new Headers(),
			returnHeaders: true
		});
		const cookie = web.headers
			.getSetCookie()
			.map((item) => item.split(';')[0] ?? '')
			.join('; ');
		const other = await fixture.accounts.loginFromApp(appLogin());

		const outcome = await fixture.accounts.changePassword(new Headers({ cookie }), {
			currentPassword: PASSWORD,
			newPassword: 'contraseña-nueva-de-prueba-456'
		});

		expect(outcome).toBe('changed');
		expect(await fixture.accounts.readSession(bearer(other.token))).toBeNull();
		// Better Auth borra todas las sesiones y crea una nueva para el dispositivo que cambia la contraseña: la cookie
		// antigua deja de valer y solo queda una sesión, la de ese dispositivo (que recibe la nueva cookie).
		expect(await fixture.accounts.readSession(new Headers({ cookie }))).toBeNull();
		expect(fixture.database.db.select().from(session).all()).toHaveLength(1);
	});
});
