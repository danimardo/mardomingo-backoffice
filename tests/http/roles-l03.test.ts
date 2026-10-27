// Matriz de roles del lote L03 contra el build (T109; 15.15; BE-FR-02, BE-FR-06, BE-FR-64; W15 `/logout`, W19
// `/panel/bienvenida`). Qué puede abrir cada tipo de cuenta: anónimo, sin verificar, usuario, administrador y bloqueado.
// Una cuenta sin verificar o bloqueada no recibe cookie de sesión, así que llega al panel como un anónimo.
import Database from 'better-sqlite3';
import { hashPassword } from 'better-auth/crypto';
import { describe, expect, inject, it } from 'vitest';
import { loginAsAdmin, loginAsUser, FORM_HEADERS } from './admin-session';
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

function get(path: string, cookie?: string): Promise<HttpResult> {
	return send(baseUrl, path, {
		host: webHost,
		headers: { accept: 'text/html', ...(cookie === undefined ? {} : { cookie }) }
	});
}

function loginWith(email: string, password: string): Promise<HttpResult> {
	return send(baseUrl, '/login?/entrar', {
		method: 'POST',
		host: webHost,
		headers: { ...FORM_HEADERS, origin: webOrigin },
		body: `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&redirectTo=%2Fpanel`
	});
}

/** Crea una cuenta con contraseña, verificada o no y bloqueada o no, directamente en la base de la prueba. */
async function createAccount(
	id: string,
	email: string,
	password: string,
	state: { readonly verified: boolean; readonly banned: boolean }
): Promise<void> {
	const db = new Database(databasePath);
	try {
		db.prepare(
			`INSERT INTO user (id, name, email, email_verified, role, banned, email_normalized, created_at, updated_at)
			 VALUES (?, '', ?, ?, 'user', ?, ?, ?, ?)`
		).run(id, email, state.verified ? 1 : 0, state.banned ? 1 : 0, email, Date.now(), Date.now());
		db.prepare(
			`INSERT INTO account (id, user_id, account_id, provider_id, password, created_at, updated_at)
			 VALUES (?, ?, ?, 'credential', ?, ?, ?)`
		).run(`acc_${id}`, id, id, await hashPassword(password), Date.now(), Date.now());
	} finally {
		db.close();
	}
}

const PANEL = '/panel';
const WELCOME = '/panel/bienvenida';

function sentToLogin(result: HttpResult): boolean {
	return result.status === 303 && String(result.headers.location).includes('/login');
}

describe('matriz de roles de L03 (BE-FR-02, BE-FR-64, W19)', () => {
	it('anónimo: el panel y la bienvenida mandan al login', async () => {
		expect(sentToLogin(await get(PANEL))).toBe(true);
		expect(sentToLogin(await get(WELCOME))).toBe(true);
	});

	it('sin verificar: el login no entrega cookie y el panel sigue cerrado', async () => {
		const email = 'sin.verificar.roles@ejemplo.es';
		const password = 'contraseña-sin-verificar-123';
		await createAccount('usr_roles_sin_verificar', email, password, {
			verified: false,
			banned: false
		});

		const login = await loginWith(email, password);

		expect(cookieOf(login)).toBe('');
		expect(sentToLogin(await get(PANEL))).toBe(true);
	});

	it('bloqueado: el login no entrega cookie y el panel sigue cerrado', async () => {
		const email = 'bloqueado.roles@ejemplo.es';
		const password = 'contraseña-bloqueado-roles-123';
		await createAccount('usr_roles_bloqueado', email, password, {
			verified: true,
			banned: true
		});

		const login = await loginWith(email, password);

		expect(cookieOf(login)).toBe('');
		expect(sentToLogin(await get(PANEL))).toBe(true);
	});

	it('usuario verificado: entra al panel y a la bienvenida sin que le manden al login', async () => {
		const session = await loginAsUser(baseUrl, databasePath, {
			id: 'usr_roles_usuario',
			email: 'usuario.roles@ejemplo.es',
			password: 'contraseña-usuario-roles-123'
		});
		const cookie = session.cookie;

		const panel = await get(PANEL, cookie);
		const welcome = await get(WELCOME, cookie);

		expect(panel.status).toBe(200);
		expect(sentToLogin(welcome)).toBe(false);
	});

	it('administrador: entra al panel de cuenta (además de la administración)', async () => {
		const admin = await loginAsAdmin(baseUrl, databasePath, {
			id: 'usr_roles_admin',
			email: 'admin.roles@ejemplo.es',
			password: 'contraseña-admin-roles-123'
		});

		const panel = await get(PANEL, admin.cookie);

		expect(panel.status).toBe(200);
	});

	it('anónimo: cerrar sesión (W15) por GET manda al login con su destino', async () => {
		expect(sentToLogin(await get('/logout'))).toBe(true);
	});

	it('sin verificar: el login no entrega cookie y la bienvenida (W19) sigue cerrada', async () => {
		const email = 'sin.verificar.bienvenida.roles@ejemplo.es';
		const password = 'contraseña-bienvenida-sin-verificar-123';
		await createAccount('usr_roles_bienvenida_sin_verificar', email, password, {
			verified: false,
			banned: false
		});

		const login = await loginWith(email, password);

		expect(cookieOf(login)).toBe('');
		expect(sentToLogin(await get(WELCOME))).toBe(true);
	});

	it('bloqueado: sin cookie, cerrar sesión (W15) y la bienvenida (W19) mandan al login', async () => {
		const email = 'bloqueado.bienvenida.roles@ejemplo.es';
		const password = 'contraseña-bloqueado-bienvenida-123';
		await createAccount('usr_roles_bienvenida_bloqueado', email, password, {
			verified: true,
			banned: true
		});

		const login = await loginWith(email, password);

		expect(cookieOf(login)).toBe('');
		expect(sentToLogin(await get('/logout'))).toBe(true);
		expect(sentToLogin(await get(WELCOME))).toBe(true);
	});

	it('usuario verificado: cerrar sesión (W15) por GET muestra la página con su cuenta', async () => {
		const session = await loginAsUser(baseUrl, databasePath, {
			id: 'usr_roles_logout_usuario',
			email: 'logout.roles@ejemplo.es',
			password: 'contraseña-logout-roles-123'
		});

		const page = await get('/logout', session.cookie);

		expect(page.status).toBe(200);
	});

	it('cerrar sesión (W15) sin cookie sigue llevando al login con el aviso', async () => {
		const result = await send(baseUrl, '/logout?/salir', {
			method: 'POST',
			host: webHost,
			headers: { ...FORM_HEADERS, origin: webOrigin },
			body: ''
		});

		expect(result.status).toBe(303);
		expect(String(result.headers.location)).toContain('/login?aviso=logged_out');
	});
});
