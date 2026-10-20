// Sesión de administrador para las pruebas HTTP (T307, T308): crea la cuenta en la base de la prueba, entra por el login real
// y devuelve la cookie. Solo puede haber un administrador por base (índice `one_admin`), así que se retira el rol de cualquiera.
import Database from 'better-sqlite3';
import { hashPassword } from 'better-auth/crypto';
import { send, type HttpResult } from './client';

export interface AdminSession {
	readonly baseUrl: string;
	readonly webHost: string;
	readonly webOrigin: string;
	readonly cookie: string;
}

export const FORM_HEADERS = {
	'content-type': 'application/x-www-form-urlencoded',
	accept: 'text/html'
} as const;

function cookieOf(result: HttpResult): string {
	const raw = result.headers['set-cookie'];
	const list = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
	return list.map((value) => value.split(';')[0] ?? '').join('; ');
}

export async function loginAsAdmin(
	baseUrl: string,
	databasePath: string,
	account: { readonly id: string; readonly email: string; readonly password: string }
): Promise<AdminSession> {
	const port = new URL(baseUrl).port;
	const webHost = `localhost:${port}`;
	const webOrigin = `http://localhost:${port}`;
	const db = new Database(databasePath);
	try {
		db.prepare("UPDATE user SET role = 'user' WHERE role = 'admin'").run();
		db.prepare(
			`INSERT INTO user (id, name, email, email_verified, role, banned, email_normalized, created_at, updated_at)
			 VALUES (?, '', ?, 1, 'admin', 0, ?, ?, ?)`
		).run(account.id, account.email, account.email, Date.now(), Date.now());
		db.prepare(
			`INSERT INTO account (id, user_id, account_id, provider_id, password, created_at, updated_at)
			 VALUES (?, ?, ?, 'credential', ?, ?, ?)`
		).run(
			`acc_${account.id}`,
			account.id,
			account.id,
			await hashPassword(account.password),
			Date.now(),
			Date.now()
		);
	} finally {
		db.close();
	}
	const login = await send(baseUrl, '/login?/entrar', {
		method: 'POST',
		host: webHost,
		headers: { ...FORM_HEADERS, origin: webOrigin },
		body: `email=${encodeURIComponent(account.email)}&password=${encodeURIComponent(account.password)}&redirectTo=%2Fadmin`
	});
	return { baseUrl, webHost, webOrigin, cookie: cookieOf(login) };
}

/** Envía un formulario de administración (con `?/accion`) con la sesión y el origen de la web. */
export function postAdmin(session: AdminSession, path: string, body: string): Promise<HttpResult> {
	return send(session.baseUrl, path, {
		method: 'POST',
		host: session.webHost,
		headers: { ...FORM_HEADERS, origin: session.webOrigin, cookie: session.cookie },
		body
	});
}

/** Sesión de una cuenta normal (sin rol de administrador) para comprobar que las acciones de administración la rechazan (T321). */
export async function loginAsUser(
	baseUrl: string,
	databasePath: string,
	account: { readonly id: string; readonly email: string; readonly password: string }
): Promise<AdminSession> {
	const port = new URL(baseUrl).port;
	const webHost = `localhost:${port}`;
	const webOrigin = `http://localhost:${port}`;
	const db = new Database(databasePath);
	try {
		db.prepare(
			`INSERT INTO user (id, name, email, email_verified, role, banned, email_normalized, created_at, updated_at)
			 VALUES (?, '', ?, 1, 'user', 0, ?, ?, ?)`
		).run(account.id, account.email, account.email, Date.now(), Date.now());
		db.prepare(
			`INSERT INTO account (id, user_id, account_id, provider_id, password, created_at, updated_at)
			 VALUES (?, ?, ?, 'credential', ?, ?, ?)`
		).run(
			`acc_${account.id}`,
			account.id,
			account.id,
			await hashPassword(account.password),
			Date.now(),
			Date.now()
		);
	} finally {
		db.close();
	}
	const login = await send(baseUrl, '/login?/entrar', {
		method: 'POST',
		host: webHost,
		headers: { ...FORM_HEADERS, origin: webOrigin },
		body: `email=${encodeURIComponent(account.email)}&password=${encodeURIComponent(account.password)}&redirectTo=%2Fpanel`
	});
	return { baseUrl, webHost, webOrigin, cookie: cookieOf(login) };
}
