// Confirmación del cambio de email (W14; C-19; BE-FR-66 CA1, CA4, CA5) contra el build: con sesión conserva la actual y redirige
// con 303 al perfil, sin ella al login, y un enlace inválido o caducado responde 400 con el texto del error (sin JavaScript).
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { describe, expect, inject, it } from 'vitest';
import { loginAsUser, FORM_HEADERS } from './admin-session';
import { send, type HttpResult } from './client';

const baseUrl = inject('httpBaseUrl');
const databasePath = inject('httpDatabasePath');
const port = new URL(baseUrl).port;
const webHost = `localhost:${port}`;
const webOrigin = `http://localhost:${port}`;

function post(token: string, cookie?: string): Promise<HttpResult> {
	return send(baseUrl, '/email/confirmar?/confirmar', {
		method: 'POST',
		host: webHost,
		headers: { ...FORM_HEADERS, origin: webOrigin, ...(cookie === undefined ? {} : { cookie }) },
		body: `token=${encodeURIComponent(token)}`
	});
}

/** Siembra un cambio de email pendiente (mismo formato que `requestEmailChange`) y devuelve su token. */
function seedChange(input: {
	readonly userId: string;
	readonly newEmail: string;
	readonly expiresAt: number;
}): string {
	const token = `token-http-${input.userId}`;
	const identifier = `email-change:${createHash('sha256').update(token, 'utf8').digest('hex')}`;
	const db = new Database(databasePath);
	try {
		db.prepare(
			`INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
		).run(
			`ver_${input.userId}`,
			identifier,
			JSON.stringify({
				userId: input.userId,
				newEmail: input.newEmail,
				normalized: input.newEmail
			}),
			input.expiresAt,
			Date.now(),
			Date.now()
		);
	} finally {
		db.close();
	}
	return token;
}

function cookieOf(result: HttpResult): string {
	const raw = result.headers['set-cookie'];
	const list = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
	return list.map((value) => value.split(';')[0] ?? '').join('; ');
}

function sessionCount(userId: string): number {
	const db = new Database(databasePath, { readonly: true });
	try {
		const value: unknown = db
			.prepare('SELECT COUNT(*) FROM session WHERE user_id = ?')
			.pluck()
			.get(userId);
		return typeof value === 'number' ? value : -1;
	} finally {
		db.close();
	}
}

async function account(slug: string) {
	const data = {
		id: `usr_http_emailchange_${slug}`,
		email: `${slug}.emailchange.http@ejemplo.es`,
		password: 'contraseña-cambio-email-123'
	};
	const session = await loginAsUser(baseUrl, databasePath, data);
	return { ...data, cookie: session.cookie };
}

describe('confirmación del cambio de email (W14, C-19)', () => {
	it('con sesión: 303 al perfil con el aviso, conserva la sesión actual y revoca las demás', async () => {
		const who = await account('con');
		const second = await send(baseUrl, '/login?/entrar', {
			method: 'POST',
			host: webHost,
			headers: { ...FORM_HEADERS, origin: webOrigin },
			body: `email=${encodeURIComponent(who.email)}&password=${encodeURIComponent(who.password)}&redirectTo=%2Fpanel`
		});
		expect(cookieOf(second)).not.toBe('');
		expect(sessionCount(who.id)).toBe(2);
		const token = seedChange({
			userId: who.id,
			newEmail: 'con.nuevo.emailchange.http@ejemplo.es',
			expiresAt: Date.now() + 3_600_000
		});

		const result = await post(token, who.cookie);

		expect(result.status).toBe(303);
		expect(String(result.headers.location)).toBe('/panel/perfil?aviso=email_changed');
		expect(sessionCount(who.id)).toBe(1);
	});

	it('sin sesión: 303 al login con el aviso', async () => {
		const who = await account('sin');
		const token = seedChange({
			userId: who.id,
			newEmail: 'sin.nuevo.emailchange.http@ejemplo.es',
			expiresAt: Date.now() + 3_600_000
		});

		const result = await post(token);

		expect(result.status).toBe(303);
		expect(String(result.headers.location)).toBe('/login?aviso=email_changed');
		expect(sessionCount(who.id)).toBe(0);
	});

	it('un enlace inexistente responde 400 con el texto de enlace no válido', async () => {
		const result = await post('token-que-no-existe');

		expect(result.status).toBe(400);
		expect(result.text).toContain('El enlace no es válido o ya se ha usado.');
	});

	it('un enlace caducado responde 400 con el texto de caducidad', async () => {
		const who = await account('cad');
		const token = seedChange({
			userId: who.id,
			newEmail: 'cad.nuevo.emailchange.http@ejemplo.es',
			expiresAt: Date.now() - 1000
		});

		const result = await post(token, who.cookie);

		expect(result.status).toBe(400);
		expect(result.text).toContain('El enlace ha caducado');
	});
});
