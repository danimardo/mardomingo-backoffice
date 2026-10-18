// Documentos legales desde el panel de administración de extremo a extremo (T314; BE-FR-70, W48). Un administrador publica una
// versión informativa y otra que exige reaceptación; cada publicación aparece como vigente en W48. La cuenta administradora se
// promueve en la base del servidor E2E (ruta en `test-results/e2e/db-path.txt`, escrita por `playwright.config.ts`); el bloqueo de IA y sincronización lo prueban
// `legal/pending.int.test.ts` y el de la reaceptación en la base.
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
	email = uniqueGmail('admin-legal');
	const request = await playwrightRequest.newContext({ baseURL: base });
	try {
		await registerThroughForm(request, base, email);
		await verifyThroughForm(request, base, verificationTokenFor(email));
	} finally {
		await request.dispose();
	}
	// Promoción a administrador: solo en la base E2E de esta ejecución.
	const db = new Database(readFileSync(join('test-results', 'e2e', 'db-path.txt'), 'utf8'));
	try {
		// Un reintento de la suite crea otra cuenta: se quita el rol antes para no violar el índice de un solo administrador.
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

async function publish(
	page: Page,
	options: { document: string; version: string; reacceptance: boolean }
): Promise<void> {
	await page.goto('/admin/legal');
	await page.waitForLoadState('networkidle');
	await page.getByLabel(/^Documento/).fill(options.document);
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
