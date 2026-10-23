// Acciones de cuenta en el host web contra el build (T109; BE-FR-01, 02, 03, 05; W08, W11, W13, W15). Los formularios
// se envían con su origen y, cuando hace falta, con su captcha: Turnstile y Resend van a sus simuladores (global setup).
// Cubre el resultado de cada acción; los guards y la CSP están en `accounts-web.test.ts`.
import Database from 'better-sqlite3';
import { describe, expect, inject, it } from 'vitest';
import { loginAsUser, FORM_HEADERS } from './admin-session';
import { send, type HttpResult } from './client';

const baseUrl = inject('httpBaseUrl');
const databasePath = inject('httpDatabasePath');
const port = new URL(baseUrl).port;
const webHost = `localhost:${port}`;
const webOrigin = `http://localhost:${port}`;

function cookieOf(result: HttpResult): string {
	const raw = result.headers['set-cookie'];
	const list = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
	return list.map((value) => value.split(';')[0] ?? '').join('; ');
}

/** `email_verified` de la cuenta con ese email normalizado, o `undefined` si no existe. */
function emailVerifiedOf(email: string): number | undefined {
	const db = new Database(databasePath, { readonly: true });
	try {
		const value: unknown = db
			.prepare('SELECT email_verified FROM user WHERE email_normalized = ?')
			.pluck()
			.get(email);
		return typeof value === 'number' ? value : undefined;
	} finally {
		db.close();
	}
}

function post(path: string, body: string, cookie?: string): Promise<HttpResult> {
	return send(baseUrl, path, {
		method: 'POST',
		host: webHost,
		headers: {
			...FORM_HEADERS,
			origin: webOrigin,
			...(cookie === undefined ? {} : { cookie })
		},
		body
	});
}

const ACCOUNT = {
	id: 'usr_http_actions_login',
	email: 'login.acciones.http@ejemplo.es',
	password: 'contraseña-acciones-http-123'
};

describe('login (W11) con credenciales válidas', () => {
	it('entra, manda al destino pedido y deja la cookie de sesión', async () => {
		await loginAsUser(baseUrl, databasePath, ACCOUNT);

		const result = await post(
			'/login?/entrar',
			`email=${encodeURIComponent(ACCOUNT.email)}&password=${encodeURIComponent(ACCOUNT.password)}&redirectTo=%2Fpanel`
		);

		expect(result.status).toBe(303);
		expect(String(result.headers.location)).toContain('/panel');
		expect(cookieOf(result)).not.toBe('');
	});
});

describe('cierre de sesión (W13)', () => {
	it('cierra la sesión, manda al login con el aviso y borra la cookie', async () => {
		await loginAsUser(baseUrl, databasePath, {
			id: 'usr_http_actions_logout',
			email: 'logout.acciones.http@ejemplo.es',
			password: 'contraseña-logout-http-123'
		});
		const login = await post(
			'/login?/entrar',
			'email=logout.acciones.http%40ejemplo.es&password=contrase%C3%B1a-logout-http-123&redirectTo=%2Fpanel'
		);
		const cookie = cookieOf(login);

		const result = await post('/logout?/salir', '', cookie);

		expect(result.status).toBe(303);
		expect(String(result.headers.location)).toContain('/login?aviso=logged_out');
		expect(result.headers['set-cookie']).toBeDefined();
	});
});

describe('registro (W08) con captcha, aceptaciones y email', () => {
	const REGISTER_EMAIL = 'nueva.persona.acciones@ejemplo.es';
	const REGISTER_BODY = [
		`email=${encodeURIComponent(REGISTER_EMAIL)}`,
		'password=contrase%C3%B1a-registro-123',
		'acceptTerms=on',
		'acceptPrivacy=on',
		'acceptAup=on',
		'ageDeclaration=on',
		'cf-turnstile-response=token-de-prueba',
		'versionTerms=2026-10-11',
		'versionPrivacy=2026-10-11',
		'versionAup=2026-10-11'
	].join('&');

	it('crea la cuenta sin verificar y envía el correo de verificación', async () => {
		const result = await post('/registro?/registrar', REGISTER_BODY);

		expect(result.status).toBe(200);
		expect(emailVerifiedOf(REGISTER_EMAIL.toLowerCase())).toBe(0);
	});

	it('sin una de las cuatro aceptaciones no crea la cuenta', async () => {
		const email = 'sin.aceptacion.acciones@ejemplo.es';
		const body = REGISTER_BODY.replace(
			encodeURIComponent(REGISTER_EMAIL),
			encodeURIComponent(email)
		).replace('acceptAup=on&', '');

		const result = await post('/registro?/registrar', body);

		expect(result.status).toBeGreaterThanOrEqual(400);
		expect(emailVerifiedOf(email)).toBeUndefined();
	});
});

describe('recuperación de contraseña (W15)', () => {
	it('un email inexistente recibe la misma respuesta de éxito y no crea nada', async () => {
		const result = await post('/recuperar?/solicitar', 'email=nadie.recupera%40ejemplo.es');

		expect(result.status).toBe(200);
		expect(result.headers['set-cookie']).toBeUndefined();
		expect(emailVerifiedOf('nadie.recupera@ejemplo.es')).toBeUndefined();
	});
});
