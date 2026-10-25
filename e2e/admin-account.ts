// Cuenta administradora compartida por los specs de administración (T322). El índice `one_admin` impide dos administradores
// en la misma base: cada spec que la usa la promueve con esta función, que es idempotente. La cuenta se fija en la base del
// servidor E2E (ruta en `test-results/e2e/db-path.txt`, escrita por `playwright.config.ts`).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { request as playwrightRequest, expect, type Page } from '@playwright/test';
import { E2E_ADMIN_EMAIL } from './constants';
import { PASSWORD, registerThroughForm, verificationTokenFor, verifyThroughForm } from './outbox';

/**
 * Registra la cuenta administradora si no existe, y promueve a administrador solo esa cuenta: si quitara el rol a otras
 * cuentas sin condición, un segundo worker degradaría al administrador del primero. Por eso solo se quitan otros roles si la
 * nuestra no lo tiene.
 */
export async function ensureAdminAccount(baseURL: string | undefined): Promise<void> {
	const base = baseURL ?? 'http://localhost:7390';
	const dbPath = readFileSync(join('test-results', 'e2e', 'db-path.txt'), 'utf8');
	const existing = new Database(dbPath);
	const known =
		existing.prepare('SELECT 1 FROM user WHERE email = ?').get(E2E_ADMIN_EMAIL) !== undefined;
	existing.close();
	if (!known) {
		const request = await playwrightRequest.newContext({ baseURL: base });
		try {
			await registerThroughForm(request, base, E2E_ADMIN_EMAIL);
			await verifyThroughForm(request, base, verificationTokenFor(E2E_ADMIN_EMAIL));
		} finally {
			await request.dispose();
		}
	}
	const db = new Database(dbPath);
	try {
		db.prepare("UPDATE user SET role = 'user' WHERE role = 'admin' AND email <> ?").run(
			E2E_ADMIN_EMAIL
		);
		db.prepare("UPDATE user SET role = 'admin' WHERE email = ?").run(E2E_ADMIN_EMAIL);
	} finally {
		db.close();
	}
}

/** Inicia sesión web con la cuenta administradora y espera al panel. */
export async function loginAsAdmin(page: Page): Promise<void> {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Email').fill(E2E_ADMIN_EMAIL);
	await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Entrar' }).click();
	await page.waitForLoadState('networkidle');
	await expect(page).toHaveURL(/\/panel$/);
}
