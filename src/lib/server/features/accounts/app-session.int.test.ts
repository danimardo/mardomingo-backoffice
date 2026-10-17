// Login de app y sesión por app contra SQLite real (T138; BE-FR-03 CA2–CA3, BE-FR-06, BE-FR-65 CA3, BE-FR-70 CA1): la
// sesión queda ligada a la app, al equipo y a la versión; la actividad por app se registra; la revocación es inmediata;
// los documentos pendientes salen en la respuesta; y `last_used_at` se escribe como mucho una vez por minuto.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { toEpochMs, type EpochMs } from '$lib/shared/time';
import { legalDocuments } from '../legal/schema';
import {
	EMAIL,
	PASSWORD,
	accountsFixture,
	codeOf,
	type AccountsFixture
} from '../../../../../tests/builders/accounts';
import {
	APP_VERSION,
	DEVICE_NAME,
	appLogin,
	bearer,
	verifiedAccount
} from '../../../../../tests/builders/app-session';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { createAccounts } from './index';
import { session, userAppActivity } from './schema';

let fixture: AccountsFixture;

beforeEach(() => {
	fixture = accountsFixture();
});

afterEach(() => {
	fixture.close();
});

function db() {
	return fixture.database.db;
}

function sessionRow(token: string) {
	return db().select().from(session).where(eq(session.token, token)).get();
}

/** Reloj que avanza a mano, para probar los intervalos de escritura. */
function movingClock(start: number) {
	let current = start;
	return {
		clock: {
			now: (): EpochMs => toEpochMs(current),
			today: () => fixture.config.clock.today()
		},
		advance(ms: number) {
			current += ms;
		}
	};
}

describe('login de app', () => {
	it('la sesión queda ligada a la app, al equipo y a la versión', async () => {
		await verifiedAccount(fixture);

		const result = await fixture.accounts.loginFromApp(appLogin());

		expect(sessionRow(result.token)).toMatchObject({
			appId: SEEDED_APP_ID,
			deviceName: DEVICE_NAME,
			appVersion: APP_VERSION
		});
	});

	it('la respuesta trae el usuario, sus roles, la caducidad y ningún documento pendiente con la versión aceptada', async () => {
		await verifiedAccount(fixture);

		const result = await fixture.accounts.loginFromApp(appLogin());

		expect(result.user).toEqual({ email: EMAIL, roles: ['user'] });
		expect(Number.isNaN(Date.parse(result.expiresAt))).toBe(false);
		expect(result.pendingAcceptances).toEqual([]);
	});

	it('una versión legal nueva deja pendiente la aceptación de ese documento', async () => {
		await verifiedAccount(fixture);
		const now = fixture.config.clock.now();
		db()
			.insert(legalDocuments)
			.values({
				id: 'ldoc_terms_nueva',
				document: 'terms',
				version: '2026-12-01',
				content: 'Texto nuevo de prueba.',
				contentHash: 'a'.repeat(64),
				requiresReacceptance: true,
				publishedAt: toEpochMs(Number(now) - 1000),
				createdBy: null,
				createdAt: now
			})
			.run();

		const result = await fixture.accounts.loginFromApp(appLogin());

		expect(result.pendingAcceptances).toEqual([{ document: 'terms', version: '2026-12-01' }]);
	});

	it('una contraseña mal escrita no abre sesión de app', async () => {
		await verifiedAccount(fixture);

		expect(
			await codeOf(() => fixture.accounts.loginFromApp(appLogin({ password: 'mal-escrita' })))
		).toBe('INVALID_CREDENTIALS');
	});

	it('una cuenta sin verificar no entra por la app', async () => {
		await fixture.accounts.register({
			email: EMAIL,
			password: PASSWORD,
			captchaToken: 'token-valido',
			remoteIp: null,
			appSlug: null,
			versions: { terms: '2026-10-11', privacy: '2026-10-11', aup: '2026-10-11' },
			ageDeclared: true
		});

		expect(await codeOf(() => fixture.accounts.loginFromApp(appLogin()))).toBe(
			'EMAIL_NOT_VERIFIED'
		);
	});
});

describe('sesión por Bearer y revocación', () => {
	it('el Bearer de la app lee la sesión con su app', async () => {
		await verifiedAccount(fixture);
		const result = await fixture.accounts.loginFromApp(appLogin());

		const current = await fixture.accounts.readSession(bearer(result.token));

		expect(current?.session.appId).toBe(SEEDED_APP_ID);
	});

	it('cerrar sesión con el Bearer revoca la sesión al momento', async () => {
		await verifiedAccount(fixture);
		const result = await fixture.accounts.loginFromApp(appLogin());
		await fixture.accounts.logout(bearer(result.token));

		expect(await fixture.accounts.readSession(bearer(result.token))).toBeNull();
	});
});

describe('actividad por app', () => {
	it('el primer login fija first_login_at y los siguientes solo mueven last_used_at', async () => {
		await verifiedAccount(fixture);
		const moving = movingClock(Number(fixture.config.clock.now()));
		const accounts = createAccounts({ ...fixture.config, clock: moving.clock });

		await accounts.loginFromApp(appLogin());
		const first = db().select().from(userAppActivity).all()[0];
		moving.advance(5 * 60 * 1000);
		await accounts.loginFromApp(appLogin());
		const second = db().select().from(userAppActivity).all()[0];

		expect(second?.firstLoginAt).toEqual(first?.firstLoginAt);
		expect(Number(second?.lastUsedAt)).toBeGreaterThan(Number(first?.lastUsedAt));
	});

	it('el último uso de la sesión se escribe como mucho una vez por minuto', async () => {
		await verifiedAccount(fixture);
		const moving = movingClock(Number(fixture.config.clock.now()));
		const accounts = createAccounts({ ...fixture.config, clock: moving.clock });
		const result = await accounts.loginFromApp(appLogin());
		const row = sessionRow(result.token);
		const scope = { sessionId: row?.id ?? '', userId: row?.userId ?? '', appId: SEEDED_APP_ID };
		const afterLogin = sessionRow(result.token)?.lastUsedAt;

		moving.advance(30 * 1000);
		accounts.touchAppSession(scope);
		expect(sessionRow(result.token)?.lastUsedAt).toEqual(afterLogin);

		moving.advance(31 * 1000);
		accounts.touchAppSession(scope);
		expect(Number(sessionRow(result.token)?.lastUsedAt)).toBeGreaterThan(Number(afterLogin));
	});
});
