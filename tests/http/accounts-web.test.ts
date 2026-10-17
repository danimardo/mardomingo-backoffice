// Cuentas en el host web contra el build (T111; N3 HTTP; D-01; contracts/web-routes.md 1.2, 1.4, 1.7). Comprueba la
// comprobación de origen de los formularios de la cuenta, la respuesta genérica del login, la sesión en el panel, el
// Bearer rechazado en la web y la CSP de Turnstile solo en el registro.
import { describe, expect, inject, it } from 'vitest';
import { send } from './client';

const baseUrl = inject('httpBaseUrl');
const port = new URL(baseUrl).port;
const webHost = `localhost:${port}`;
const webOrigin = `http://localhost:${port}`;

const form = { 'content-type': 'application/x-www-form-urlencoded', accept: 'text/html' };
const LOGIN_BODY =
	'email=nadie%40ejemplo.es&password=contrase%C3%B1a-mal-escrita&redirectTo=%2Fpanel';

describe('login (W11) en el host web', () => {
	it('sin Origin, la action no se ejecuta y responde 403 sin cookie', async () => {
		const result = await send(baseUrl, '/login?/entrar', {
			method: 'POST',
			host: webHost,
			headers: form,
			body: LOGIN_BODY
		});

		expect(result.status).toBe(403);
		expect(result.headers['set-cookie']).toBeUndefined();
	});

	it('con el origen propio y credenciales erróneas, responde 401 genérico sin cookie', async () => {
		const result = await send(baseUrl, '/login?/entrar', {
			method: 'POST',
			host: webHost,
			headers: { ...form, origin: webOrigin },
			body: LOGIN_BODY
		});

		expect(result.status).toBe(401);
		// El email vuelve al campo; la contraseña nunca vuelve en la respuesta.
		expect(result.text).not.toContain('mal-escrita');
		expect(result.headers['set-cookie']).toBeUndefined();
	});
});

describe('sesión en la web', () => {
	it('el panel sin sesión manda al login con el destino guardado', async () => {
		const result = await send(baseUrl, '/panel', { host: webHost });

		expect(result.status).toBe(303);
		expect(String(result.headers.location)).toContain('/login?redirectTo=%2Fpanel');
	});

	it('un Bearer en la web no abre el panel: se ignora y se pide login', async () => {
		const result = await send(baseUrl, '/panel', {
			host: webHost,
			headers: { authorization: 'Bearer token-de-una-app' }
		});

		expect(result.status).toBe(303);
		expect(String(result.headers.location)).toContain('/login');
	});

	it('la bienvenida y el cierre también exigen sesión', async () => {
		const welcome = await send(baseUrl, '/panel/bienvenida', { host: webHost });
		const logout = await send(baseUrl, '/logout', { host: webHost });

		expect(welcome.status).toBe(303);
		expect(logout.status).toBe(303);
		expect(String(logout.headers.location)).toContain('/login');
	});
});

describe('cookies en el host de la API', () => {
	it('una cookie de sesión no cambia la respuesta de la API y la API nunca devuelve set-cookie', async () => {
		const plain = await send(baseUrl, '/api/v1/health', {
			host: webHost,
			headers: { accept: 'application/json' }
		});
		const withCookie = await send(baseUrl, '/api/v1/health', {
			host: webHost,
			headers: { accept: 'application/json', cookie: 'better-auth.session_token=cookie-falsa' }
		});

		expect(withCookie.status).toBe(plain.status);
		expect(withCookie.headers['set-cookie']).toBeUndefined();
	});
});

describe('Turnstile solo en el registro (FR-102)', () => {
	it('la CSP de /registro admite el origen de Turnstile en script-src y frame-src', async () => {
		const result = await send(baseUrl, '/registro', { host: webHost });
		const policy = String(result.headers['content-security-policy'] ?? '');

		expect(result.status).toBe(200);
		expect(policy).toMatch(/script-src [^;]*https:\/\/challenges\.cloudflare\.com/);
		expect(policy).toMatch(/frame-src [^;]*https:\/\/challenges\.cloudflare\.com/);
	});

	it('la CSP de /login no admite Cloudflare', async () => {
		const result = await send(baseUrl, '/login', { host: webHost });
		const policy = String(result.headers['content-security-policy'] ?? '');

		expect(result.status).toBe(200);
		expect(policy).not.toContain('challenges.cloudflare.com');
	});
});
