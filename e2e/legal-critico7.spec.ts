// Crítico 7 (T288, BE-FR-70, BE-FR-07): una versión legal que exige aceptación publicada por el administrador avisa en el
// panel, y la API de app responde `TERMS_ACCEPTANCE_REQUIRED` hasta que el usuario acepta. Crítico 10 en su parte legal: la
// aceptación se envía sin JavaScript. Publicar cambia la base para todas las cuentas, así que este spec corre en su propio
// proyecto (`legal-critico7`), después de todos los demás, y sus pruebas van en serie.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import { expect, test } from './fixtures';
import { E2E_ADMIN_EMAIL } from './constants';
import { checkAccessibility } from './fixtures/axe';
import { PASSWORD, registerThroughForm, verificationTokenFor, verifyThroughForm } from './outbox';

test.describe.configure({ mode: 'serial' });

const DB_POINTER = join('test-results', 'e2e', 'db-path.txt');
const USER_EMAIL = 'usuario.e2e@ejemplo.es';
/** Versión nueva del documento: posterior a la sembrada y única en cada ejecución (la base es nueva en cada una). */
const NEW_VERSION = '2090-01-01';
/** Segunda versión, solo de términos, para la prueba sin JavaScript: los demás documentos ya están aceptados. */
const NEW_VERSION_SIN_JS = '2090-01-02';
const CHAT_BODY = JSON.stringify({
	operation: 'improve',
	messages: [{ role: 'user', content: 'Revisa este párrafo, por favor.' }]
});

let adminEmail = '';

function openDatabase(): Database.Database {
	return new Database(readFileSync(DB_POINTER, 'utf8'));
}

/** Llamada de chat de app con el token; devuelve el estado y el código de error si lo hay. */
async function chatWith(
	api: APIRequestContext,
	origin: string,
	token: string
): Promise<{ status: number; code: string | null }> {
	const response = await api.post(`${origin}/api/v1/ai/chat`, {
		headers: {
			'content-type': 'application/json',
			accept: 'application/json',
			'x-app-id': 'secretario',
			'x-app-version': '4.0.0',
			'x-device-name': 'PC-E2E-CRITICO-7',
			authorization: `Bearer ${token}`
		},
		data: CHAT_BODY
	});
	const text = await response.text();
	const parsed: unknown = text === '' ? {} : JSON.parse(text);
	const error =
		typeof parsed === 'object' && parsed !== null && 'error' in parsed ? parsed.error : undefined;
	const code =
		typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
			? error.code
			: null;
	return { status: response.status(), code };
}

async function appTokenFor(api: APIRequestContext, origin: string): Promise<string> {
	const response = await api.post(`${origin}/api/v1/auth/login`, {
		headers: {
			'content-type': 'application/json',
			accept: 'application/json',
			'x-app-id': 'secretario',
			'x-app-version': '4.0.0',
			'x-device-name': 'PC-E2E-CRITICO-7'
		},
		data: JSON.stringify({ email: USER_EMAIL, password: PASSWORD })
	});
	expect(response.status()).toBe(200);
	const body: unknown = await response.json();
	const token =
		typeof body === 'object' && body !== null && 'token' in body ? body.token : undefined;
	if (typeof token !== 'string') throw new Error('el login de app no devuelve token');
	return token;
}

/** Publica una versión de los términos con reaceptación como administrador, por formulario (W-admin `publicar`). */
async function publicarTerminos(origin: string, version: string): Promise<void> {
	const admin = await playwrightRequest.newContext({ baseURL: origin });
	try {
		const login = await admin.post('/login?/entrar', {
			headers: {
				'content-type': 'application/x-www-form-urlencoded',
				accept: 'text/html',
				origin
			},
			form: { email: adminEmail, password: PASSWORD, redirectTo: '/admin' },
			maxRedirects: 0
		});
		expect(login.status()).toBeLessThan(400);
		const published = await admin.post('/admin/legal?/publicar', {
			headers: {
				'content-type': 'application/x-www-form-urlencoded',
				accept: 'text/html',
				origin
			},
			form: {
				documento: 'terms',
				version,
				contenido: 'Términos de prueba E2E con reaceptación.',
				requiereReaceptacion: 'true',
				confirmado: 'true'
			},
			maxRedirects: 0
		});
		expect(published.status()).toBe(303);
	} finally {
		await admin.dispose();
	}
}

test.beforeAll(async ({ baseURL }) => {
	const base = baseURL ?? 'http://localhost:7390';
	adminEmail = E2E_ADMIN_EMAIL;
	const dbPath = readFileSync(DB_POINTER, 'utf8');
	const known = new Database(dbPath);
	const exists = known.prepare('SELECT 1 FROM user WHERE email = ?').get(adminEmail) !== undefined;
	known.close();
	if (!exists) {
		const request = await playwrightRequest.newContext({ baseURL: base });
		try {
			await registerThroughForm(request, base, adminEmail);
			await verifyThroughForm(request, base, verificationTokenFor(adminEmail));
		} finally {
			await request.dispose();
		}
	}
	const db = openDatabase();
	try {
		// Solo un administrador por base: se quita el rol a las demás cuentas y se mantiene el de la cuenta compartida.
		db.prepare("UPDATE user SET role = 'user' WHERE role = 'admin' AND email <> ?").run(adminEmail);
		db.prepare("UPDATE user SET role = 'admin' WHERE email = ?").run(adminEmail);
	} finally {
		db.close();
	}
});

test('@BE-FR-70 @BE-FR-07 @UX-11 una versión legal que exige aceptación bloquea la API hasta que el usuario acepta', async ({
	browser,
	baseURL
}, testInfo) => {
	const origin = baseURL ?? 'http://localhost:7390';
	const apiOrigin = origin.replace('localhost', '127.0.0.1');

	// 1. El administrador publica la nueva versión de los términos con reaceptación.
	await publicarTerminos(origin, NEW_VERSION);

	// 2. La API de app, con el token del usuario, responde TERMS_ACCEPTANCE_REQUIRED.
	const api = await playwrightRequest.newContext({ baseURL: apiOrigin });
	try {
		const token = await appTokenFor(api, apiOrigin);
		const blocked = await chatWith(api, apiOrigin, token);
		expect(blocked.status).toBe(403);
		expect(blocked.code).toBe('TERMS_ACCEPTANCE_REQUIRED');
	} finally {
		await api.dispose();
	}

	// 3. El panel avisa del documento pendiente y ofrece aceptarlo.
	const context = await browser.newContext({
		baseURL: origin,
		storageState: 'e2e/.auth/user.json'
	});
	const page = await context.newPage();
	try {
		await page.goto('/panel');
		await expect(page.getByText('Hay documentos legales pendientes de aceptar.')).toBeVisible();
		// UX-11: el aviso explica qué deja de funcionar y enlaza cada documento, que responde con 200 y se abre en una pestaña nueva.
		await expect(
			page.getByText(
				'Hasta que los aceptes, las apps no atenderán nuevas peticiones que usen tus créditos ni tu documento.'
			)
		).toBeVisible();
		const reads = page.getByRole('link', { name: /\(se abre en una pestaña nueva\)$/ });
		await expect(reads).toHaveCount(3);
		for (const link of await reads.all()) {
			await expect(link).toHaveAttribute('target', '_blank');
			const href = await link.getAttribute('href');
			expect(href, 'el enlace del documento no tiene destino').not.toBeNull();
			const response = await page.request.get(href ?? '/');
			expect(response.status(), `el documento ${String(href)} debe responder 200`).toBe(200);
		}
		// T289: el aviso con documentos pendientes también debe ser accesible en ambos temas.
		for (const scheme of ['light', 'dark'] as const) {
			await page.emulateMedia({ colorScheme: scheme });
			await page.goto('/panel');
			await checkAccessibility(page, testInfo);
		}
		// La cuenta del setup no tiene aceptaciones previas: están pendientes los tres documentos, no solo los términos.
		for (const box of await page.getByRole('checkbox').all()) {
			await box.check();
		}
		await page.getByRole('button', { name: 'Aceptar documentos' }).click();
		await expect(page).toHaveURL(/\/panel\?aviso=terms_accepted/);
		await expect(page.getByText('Hay documentos legales pendientes de aceptar.')).toHaveCount(0);
	} finally {
		await context.close();
	}

	// 4. Con la aceptación registrada, la API deja de bloquear el chat por ese motivo.
	const after = await playwrightRequest.newContext({ baseURL: apiOrigin });
	try {
		const fresh = await appTokenFor(after, apiOrigin);
		const unblocked = await chatWith(after, apiOrigin, fresh);
		expect(unblocked.code).not.toBe('TERMS_ACCEPTANCE_REQUIRED');
	} finally {
		await after.dispose();
	}
});

// Crítico 10 (T288, sin JavaScript): la aceptación de un documento pendiente se envía con el formulario del panel y el aviso desaparece.
test.describe('sin JavaScript', () => {
	test.use({
		javaScriptEnabled: false,
		guardAllow: [
			/__data\.json.*ERR_ABORTED|requestfailed: .*\(csp\)|status of 400|Load request cancelled/
		]
	});

	test('@critical @BE-FR-70 @BE-FR-07 @UX-11 aceptar un documento pendiente se envía sin JavaScript', async ({
		page,
		baseURL
	}) => {
		const origin = baseURL ?? 'http://localhost:7390';
		await publicarTerminos(origin, NEW_VERSION_SIN_JS);

		await page.goto('/login');
		await page.getByLabel('Email').fill(USER_EMAIL);
		await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
		await page.getByRole('button', { name: 'Entrar' }).click();
		await expect(page).toHaveURL(/\/panel$/);

		await expect(page.getByText('Hay documentos legales pendientes de aceptar.')).toBeVisible();
		const form = page.locator('form[action="?/aceptarDocumentos"]');
		// Solo los términos cambian de versión: el aviso pide aceptar uno, no los tres.
		await expect(form.getByRole('checkbox')).toHaveCount(1);
		await form.getByRole('checkbox').check();
		await form.getByRole('button', { name: 'Aceptar documentos' }).click();

		await expect(page).toHaveURL(/\/panel\?aviso=terms_accepted$/);
		await expect(page.getByText('Hay documentos legales pendientes de aceptar.')).toHaveCount(0);
	});
});
