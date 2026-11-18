// C-59 (T450; C-35; BE-FR-04, BE-FR-45): la IP del cliente sale solo de `event.getClientAddress()` (aquí, `X-Forwarded-For` a un
// salto, como detrás del proxy). Un cliente que envía la cabecera interna `x-mm-client-ip` no fija la IP de su sesión, ni en el
// login de la web ni en el de la API: `hooks.server.ts` la quita de toda petición (`stripInternalHeaders`) y `accounts` construye
// las cabeceras de Better Auth con la IP real (`headersFor`). Que ningún paso ve la cabecera lo comprueba `src/hooks.server.test.ts`.
import Database from 'better-sqlite3';
import { hashPassword } from 'better-auth/crypto';
import { beforeAll, describe, expect, inject, it } from 'vitest';
import { FORM_HEADERS } from './admin-session';
import { send } from './client';

const baseUrl = inject('httpBaseUrl');
const databasePath = inject('httpDatabasePath');
const port = new URL(baseUrl).port;
const webHost = `localhost:${port}`;
const webOrigin = `http://localhost:${port}`;
const apiHost = new URL(baseUrl).host;

const USER_ID = 'usr_http_c59_ip';
const EMAIL = 'ip.c59@ejemplo.es';
const PASSWORD = 'contraseña-c59-ip-123';
const SPOOFED_IP = '203.0.113.9';

/** IP guardada en la sesión más reciente de la cuenta de la prueba. */
function lastSessionIp(): string | null | undefined {
	const db = new Database(databasePath, { readonly: true });
	try {
		return db
			.prepare<[string], { ip: string | null }>(
				'SELECT ip_address AS ip FROM session WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1'
			)
			.get(USER_ID)?.ip;
	} finally {
		db.close();
	}
}

beforeAll(async () => {
	const db = new Database(databasePath);
	try {
		const now = Date.now();
		db.prepare(
			`INSERT INTO user (id, name, email, email_verified, role, banned, email_normalized, created_at, updated_at)
			 VALUES (?, '', ?, 1, 'user', 0, ?, ?, ?)`
		).run(USER_ID, EMAIL, EMAIL, now, now);
		db.prepare(
			`INSERT INTO account (id, user_id, account_id, provider_id, password, created_at, updated_at)
			 VALUES (?, ?, ?, 'credential', ?, ?, ?)`
		).run(`acc_${USER_ID}`, USER_ID, USER_ID, await hashPassword(PASSWORD), now, now);
	} finally {
		db.close();
	}
});

describe('[C-59] la cabecera x-mm-client-ip del cliente no fija la IP de la sesión', () => {
	it('login en la web: la sesión guarda la IP de X-Forwarded-For, no la de la cabecera interna', async () => {
		const result = await send(baseUrl, '/login?/entrar', {
			method: 'POST',
			host: webHost,
			headers: {
				...FORM_HEADERS,
				origin: webOrigin,
				'x-forwarded-for': '198.51.100.59',
				'x-mm-client-ip': SPOOFED_IP
			},
			body: `email=${encodeURIComponent(EMAIL)}&password=${encodeURIComponent(PASSWORD)}&redirectTo=%2Fpanel`
		});

		expect(result.status).toBe(303);
		expect(lastSessionIp()).toBe('198.51.100.59');
	});

	it('login en la API: tampoco', async () => {
		const result = await send(baseUrl, '/api/v1/auth/login', {
			method: 'POST',
			host: apiHost,
			headers: {
				'content-type': 'application/json',
				accept: 'application/json',
				'x-app-id': 'secretario',
				'x-app-version': '4.0.0',
				'x-forwarded-for': '198.51.100.60',
				'x-mm-client-ip': SPOOFED_IP
			},
			body: JSON.stringify({ email: EMAIL, password: PASSWORD })
		});

		expect(result.status).toBe(200);
		expect(lastSessionIp()).toBe('198.51.100.60');
	});
});
