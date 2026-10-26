// Cierre de administración (T322; BE-FR-27, BE-FR-42, BE-FR-47, BE-FR-50, BE-FR-52). Corre en su proyecto al final, después de
// todos los navegadores y de `legal-critico7`: el mantenimiento corta el chat para todas las cuentas y el reembolso cambia el
// saldo de la cuenta de compra, así que no puede correr en paralelo con el resto. Usa la cuenta administradora de
// `admin-account.ts`, que se promueve en su propio `beforeAll`. Las pruebas van en serie: la compra y el reembolso usan la cuenta
// del E2E (`user.json`, `usr_e2e_user`), distinta de la del panel (`usr_panel`), cuyas sesiones cierra la última prueba.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import type { APIRequestContext, Page } from '@playwright/test';
import { ensureAdminAccount, loginAsAdmin } from './admin-account';
import { E2E_ADMIN_EMAIL } from './constants';
import { expect, test } from './fixtures';
import { PASSWORD } from './outbox';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ baseURL }) => {
	await ensureAdminAccount(baseURL);
});

const APP_HEADERS = { 'x-app-id': 'secretario', 'x-app-version': '4.0.0' };

/** Origen de la API en las pruebas: `127.0.0.1` y no `localhost`, como en `legal-critico7` (separación por host, T130). */
function apiOriginOf(baseURL: string | undefined): string {
	return (baseURL ?? 'http://localhost:7390').replace('localhost', '127.0.0.1');
}

/** Abre la base del servidor E2E en solo lectura, con la ruta que escribe `playwright.config.ts`. */
function openDb(): Database.Database {
	const path = readFileSync(join('test-results', 'e2e', 'db-path.txt'), 'utf8').trim();
	return new Database(path, { readonly: true });
}

function objectOf(value: unknown): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new Error('se esperaba un objeto');
	}
	return Object.fromEntries(Object.entries(value));
}

/** Una fila de la base como objeto; `undefined` si no hay ninguna. */
function rowOf(db: Database.Database, sql: string, ...params: string[]) {
	const row: unknown = db.prepare(sql).get(...params);
	return row === undefined ? undefined : objectOf(row);
}

/** Fija el mantenimiento de la app por el panel: vista previa, motivo, confirmación y guardar. */
async function setMaintenance(page: Page, next: { active: boolean; message: string }) {
	await page.goto('/admin/apps/secretario');
	await page.waitForLoadState('networkidle');

	const section = page.locator('section[aria-labelledby="mantenimiento"]');
	await section.locator('#activo-mantenimiento').setChecked(next.active);
	await section.locator('#mensaje-mantenimiento').fill(next.message);
	await section
		.locator('form[action="?/previsualizarMantenimiento"]')
		.getByRole('button', { name: 'Ver vista previa' })
		.click();
	await page.waitForLoadState('networkidle');

	await section.locator('#motivo-mantenimiento').fill('Prueba E2E de mantenimiento');
	await section.locator('#confirmado-mantenimiento').check();
	await section.getByRole('button', { name: 'Guardar mantenimiento' }).click();
	await page.waitForURL(/\/admin\/apps\/secretario$/);
	await page.waitForLoadState('networkidle');
}

/** Token de la app para la cuenta administradora (inicio de sesión de la API, como lo hace la app cliente). */
async function appToken(request: APIRequestContext, origin: string): Promise<string> {
	const response = await request.post(`${origin}/api/v1/auth/login`, {
		headers: { ...APP_HEADERS, 'x-device-name': 'E2E cierre' },
		data: { email: E2E_ADMIN_EMAIL, password: PASSWORD }
	});
	expect(response.status()).toBe(200);
	const token = objectOf(await response.json()).token;
	if (typeof token !== 'string') throw new Error('el inicio de sesión no devolvió token');
	return token;
}

test('@BE-FR-47 @BE-FR-52 el mantenimiento se activa con vista previa, la API responde 503 y se desactiva', async ({
	page,
	request,
	baseURL
}) => {
	const origin = apiOriginOf(baseURL);
	await loginAsAdmin(page);
	try {
		await setMaintenance(page, { active: true, message: 'Mantenimiento de prueba E2E' });

		const status = await request.get(`${origin}/api/v1/app/status`, { headers: APP_HEADERS });
		const statusBody = await status.text();
		expect(status.status(), statusBody).toBe(200);
		expect(JSON.parse(statusBody)).toMatchObject({ maintenance: { active: true } });

		const token = await appToken(request, origin);
		const chat = await request.post(`${origin}/api/v1/ai/chat`, {
			headers: {
				...APP_HEADERS,
				authorization: `Bearer ${token}`,
				'idempotency-key': randomUUID()
			},
			data: { operation: 'improve', messages: [{ role: 'user', content: 'Hola' }] }
		});
		expect(chat.status()).toBe(503);
		expect(await chat.json()).toMatchObject({ error: { code: 'MAINTENANCE' } });
	} finally {
		await setMaintenance(page, { active: false, message: '' });
	}

	const after = await request.get(`${origin}/api/v1/app/status`, { headers: APP_HEADERS });
	expect(await after.json()).toMatchObject({ maintenance: { active: false } });
});

test('@BE-FR-42 copiar una sola casilla a predeterminados sustituye solo su categoría', async ({
	page
}) => {
	await loginAsAdmin(page);
	await page.goto('/admin/apps/secretario/predeterminados');
	await page.waitForLoadState('networkidle');
	const before = objectOf(JSON.parse(await page.locator('#datos').inputValue()));

	await page.goto('/admin/apps/secretario/predeterminados/copiar?usuario=usr_panel');
	await page.waitForLoadState('networkidle');
	await page.getByRole('group', { name: 'coreReplacements' }).getByRole('checkbox').first().check();
	await page.getByRole('checkbox', { name: 'Confirmo este cambio' }).check();
	await page.getByRole('button', { name: 'Copiar los elementos marcados' }).click();
	await page.waitForURL(/\/predeterminados$/);
	await page.waitForLoadState('networkidle');
	const after = objectOf(JSON.parse(await page.locator('#datos').inputValue()));

	// La categoría con casilla marcada toma el valor de la cuenta de origen; las demás quedan como estaban (exclusión).
	const db = openDb();
	try {
		const source = rowOf(
			db,
			"SELECT data FROM sync_documents WHERE user_id = ? AND app_id = 'app_secretario'",
			'usr_panel'
		);
		if (source === undefined || typeof source.data !== 'string') {
			throw new Error('la cuenta de origen no tiene documento de sincronización');
		}
		expect(after.coreReplacements).toEqual(objectOf(JSON.parse(source.data)).coreReplacements);
	} finally {
		db.close();
	}
	for (const category of ['customReplacements', 'quickTexts', 'prompts', 'preferences']) {
		expect(after[category], `la categoría ${category} no marcada no cambia`).toEqual(
			before[category]
		);
	}
});

test('@BE-FR-27 reembolsar una compra recién pagada: la vista previa no cambia nada y el reembolso la deja reembolsada', async ({
	browser,
	page,
	baseURL
}) => {
	// Compra, login y reembolso en una sola prueba: supera los 30 s por defecto (compra en el simulador y dos inicios de sesión).
	test.setTimeout(120_000);
	// Compra nueva con la cuenta de usuario del E2E (el mismo flujo de la matriz de compra): su bolsa está sin gastar, así que
	// se puede reembolsar. Las compras de la base ya gastaron sus créditos en otras pruebas y no sirven.
	const buyer = await browser.newContext({
		baseURL: baseURL ?? 'http://localhost:7390',
		storageState: 'e2e/.auth/user.json'
	});
	const shop = await buyer.newPage();
	try {
		await shop.goto('/panel/comprar?paquete=pck_seed_5eur');
		await shop.getByLabel(/renuncio a mi derecho de desistimiento/).check();
		await shop.getByRole('button', { name: /Comprar 5,00\s€ de créditos/ }).click();
		await expect(shop).toHaveURL(/\/panel\/comprar\/pay_/);
	} finally {
		await shop.close();
		await buyer.close();
	}

	const db = openDb();
	const payment = rowOf(
		db,
		"SELECT id, user_id AS userId, amount_eur_cents AS amount FROM payments WHERE status = 'completed' ORDER BY created_at DESC LIMIT 1"
	);
	db.close();
	if (
		payment === undefined ||
		typeof payment.id !== 'string' ||
		typeof payment.userId !== 'string' ||
		typeof payment.amount !== 'number'
	) {
		throw new Error('la compra de la prueba no quedó registrada como completada');
	}
	const { id, userId, amount } = { id: payment.id, userId: payment.userId, amount: payment.amount };

	await loginAsAdmin(page);
	await page.goto(`/admin/usuarios/${userId}/pagos/${id}/reembolso`);
	await page.waitForLoadState('networkidle');
	await page.locator('#importe').fill(String(amount));
	await page.locator('#motivo').fill('Reembolso de prueba E2E');
	await page.getByRole('button', { name: 'Ver vista previa' }).click();
	await page.waitForLoadState('networkidle');

	const check = openDb();
	try {
		expect(
			rowOf(check, 'SELECT status FROM payments WHERE id = ?', id)?.status,
			'la vista previa no reembolsa'
		).toBe('completed');
	} finally {
		check.close();
	}

	await page.locator('#importe').fill(String(amount));
	await page.locator('#motivo').fill('Reembolso de prueba E2E');
	await page.locator('#confirmado').check();
	await page.getByRole('button', { name: 'Reembolsar', exact: true }).click();
	await page.waitForURL(/aviso=reembolso_aplicado/);

	const done = openDb();
	try {
		const row = rowOf(
			done,
			'SELECT status, refunded_eur_cents AS refunded FROM payments WHERE id = ?',
			id
		);
		expect(row).toEqual({ status: 'refunded', refunded: amount });
	} finally {
		done.close();
	}
});

test('@BE-FR-50 cerrar las sesiones de una ficha observa el POST y vuelve a la misma ficha', async ({
	page
}) => {
	await loginAsAdmin(page);
	await page.goto('/admin/usuarios/usr_panel');
	await page.waitForLoadState('networkidle');

	const form = page.locator('form[action="?/cerrarSesiones"]');
	await form.locator('#motivo-sesiones').fill('Prueba E2E de cierre de sesiones');
	await form.locator('#confirmado-sesiones').check();
	const [response] = await Promise.all([
		page.waitForResponse(
			(candidate) =>
				candidate.request().method() === 'POST' && candidate.url().includes('cerrarSesiones')
		),
		form.getByRole('button', { name: 'Cerrar todas las sesiones' }).click()
	]);
	expect(response.status()).toBe(303);

	await page.waitForLoadState('networkidle');
	await expect(page).toHaveURL(/\/admin\/usuarios\/usr_panel$/);
});
