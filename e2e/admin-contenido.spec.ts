// Administración de contenido de extremo a extremo (T314, T315; W48, W49). Un solo spec con una sola cuenta administradora: el
// índice `one_admin` impide dos administradores en la misma base, y cada spec no puede promover el suyo. La cuenta se promueve en la
// base del servidor E2E (ruta en `test-results/e2e/db-path.txt`, escrita por `playwright.config.ts`).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { request as playwrightRequest, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import {
	PASSWORD,
	registerThroughForm,
	uniqueGmail,
	verificationTokenFor,
	verifyThroughForm
} from './outbox';

test.describe.configure({ mode: 'serial' });

let email = '';

test.beforeAll(async ({ baseURL }) => {
	const base = baseURL ?? 'http://localhost:7390';
	email = uniqueGmail('admin-contenido');
	const request = await playwrightRequest.newContext({ baseURL: base });
	try {
		await registerThroughForm(request, base, email);
		await verifyThroughForm(request, base, verificationTokenFor(email));
	} finally {
		await request.dispose();
	}
	const db = new Database(readFileSync(join('test-results', 'e2e', 'db-path.txt'), 'utf8'));
	try {
		// Un reintento crea otra cuenta: se quita el rol antes para no violar el índice de un solo administrador.
		db.prepare("UPDATE user SET role = 'user' WHERE role = 'admin'").run();
		db.prepare("UPDATE user SET role = 'admin' WHERE email = ?").run(email);
	} finally {
		db.close();
	}
});

async function loginAsAdmin(page: Page): Promise<void> {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Entrar' }).click();
	await page.waitForLoadState('networkidle');
	await expect(page).toHaveURL(/\/panel$/);
}

// --- Documentos legales (W48) ---

async function publish(
	page: Page,
	options: { document: string; version: string; reacceptance: boolean }
): Promise<void> {
	await page.goto('/admin/legal');
	await page.waitForLoadState('networkidle');
	await page.locator('input#documento').fill(options.document);
	await page.getByLabel(/^Versión \(fecha de publicación\)/).fill(options.version);
	await page.getByLabel(/^Contenido en Markdown/).fill(`# Versión ${options.version}`);
	if (options.reacceptance) {
		await page.getByLabel(/^Exige que cada persona lo acepte de nuevo/).check();
	}
	await page.getByLabel(/^Confirmo que quiero publicar esta versión/).check();
	await page.getByRole('button', { name: 'Publicar', exact: true }).click();
	await page.waitForLoadState('networkidle');
}

// Solo documentos que el registro no acepta (términos, privacidad y uso aceptable): otros specs se registran con la versión inicial.
test('@BE-FR-70 un administrador publica una versión informativa y aparece como vigente', async ({
	page
}) => {
	await loginAsAdmin(page);
	await publish(page, { document: 'cookies', version: '2026-12-01', reacceptance: false });

	await expect(page).toHaveURL(/\/admin\/legal$/);
	await expect(page.getByText('cookies · 2026-12-01')).toBeVisible();
});

test('@BE-FR-70 una versión que exige reaceptación se marca como tal en W48', async ({ page }) => {
	await loginAsAdmin(page);
	await publish(page, { document: 'withdrawal_waiver', version: '2026-12-15', reacceptance: true });

	await expect(page.getByText(/withdrawal_waiver · 2026-12-15 · .*reaceptación/)).toBeVisible();
});

// --- Anuncios (W49) ---

async function fillAnnouncement(page: Page, message: string): Promise<void> {
	await page.goto('/admin/anuncios');
	await page.waitForLoadState('networkidle');
	const nuevo = page.getByRole('region', { name: 'Nuevo anuncio' });
	await nuevo.getByLabel(/^Mensaje/).fill(message);
	await nuevo.getByLabel(/^Nivel/).selectOption('info');
	await nuevo.getByLabel(/^Inicio/).fill('2026-10-01T08:00');
}

test('@BE-FR-85 previsualizar muestra el anuncio sin guardarlo', async ({ page }) => {
	await loginAsAdmin(page);
	const message = 'Previsualización E2E sin guardar';
	await fillAnnouncement(page, message);
	await page
		.getByRole('region', { name: 'Nuevo anuncio' })
		.getByRole('button', { name: 'Previsualizar' })
		.click();
	await page.waitForLoadState('networkidle');

	await expect(page.getByRole('heading', { name: 'Vista previa' })).toBeVisible();
	await expect(page.getByText(message)).toBeVisible();
	await expect(page.getByText('Así se verá. Todavía no se ha guardado nada.')).toBeVisible();
	await page.goto('/admin/anuncios');
	await expect(page.getByText(message)).toHaveCount(0);
});

test('@BE-FR-85 un anuncio creado aparece en la lista con su identificador', async ({ page }) => {
	await loginAsAdmin(page);
	const message = 'Anuncio E2E creado';
	await fillAnnouncement(page, message);
	await page
		.getByRole('region', { name: 'Nuevo anuncio' })
		.getByRole('button', { name: 'Crear anuncio' })
		.click();
	await page.waitForLoadState('networkidle');

	await expect(page.getByText(message)).toBeVisible();
	await expect(page.locator('code').filter({ hasText: /^ann_/ }).first()).toBeVisible();
});

test('@BE-FR-76 la facturación filtra un periodo y descarga el CSV de ventas con su nombre', async ({
	page
}) => {
	await loginAsAdmin(page);
	await page.goto('/admin/facturacion?desde=2026-10-01&hasta=2026-10-31');
	await page.waitForLoadState('networkidle');

	await expect(page.getByText('Ventas en el periodo: 0')).toBeVisible();
	const href = await page
		.getByRole('link', { name: 'Descargar ventas (CSV)' })
		.getAttribute('href');
	expect(href).toContain('/admin/facturacion/exportar?archivo=ventas');

	const response = await page.request.get(href ?? '');
	expect(response.status()).toBe(200);
	expect(response.headers()['content-type']).toContain('text/csv');
	expect(response.headers()['content-disposition']).toContain('attachment');
});

test('@BE-FR-54 las estadísticas muestran «sin datos» donde no hay datos, nunca cero', async ({
	page
}) => {
	await loginAsAdmin(page);
	await page.goto('/admin/estadisticas?desde=2026-10-01&hasta=2026-10-31');
	await page.waitForLoadState('networkidle');

	await expect(page.getByRole('heading', { name: 'Estadísticas', level: 1 })).toBeVisible();
	await expect(page.getByText('descargas: sin datos')).toBeVisible();
	await expect(page.getByText(/^altas: /)).toBeVisible();
});
