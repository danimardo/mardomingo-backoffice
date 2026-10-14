// Panel de la cuenta de extremo a extremo (T272; BE-FR-49, BE-FR-66; UX-18). Una cuenta verificada entra, recorre las páginas del
// panel (cada una con su título y sin errores de servidor) y pide un cambio de email desde el perfil. Va en serie: comparte la
// cuenta creada una vez, por el límite de altas por IP del servidor de pruebas (tres en 24 h).
import { request as playwrightRequest } from '@playwright/test';
import { checkAccessibility } from './fixtures/axe';
import { expect, test } from './fixtures';
import {
	PASSWORD,
	registerThroughForm,
	uniqueGmail,
	verificationTokenFor,
	verifyThroughForm
} from './outbox';

test.describe.configure({ mode: 'serial' });

const PANEL_PAGES = [
	'/panel',
	'/panel/comprar',
	'/panel/movimientos',
	'/panel/consumo',
	'/panel/sesiones',
	'/panel/perfil',
	'/panel/apps',
	'/panel/facturas'
] as const;

let email = '';

test.beforeAll(async ({ baseURL }) => {
	const base = baseURL ?? 'http://localhost:7390';
	email = uniqueGmail('panel');
	const request = await playwrightRequest.newContext({ baseURL: base });
	try {
		await registerThroughForm(request, base, email);
		await verifyThroughForm(request, base, verificationTokenFor(email));
	} finally {
		await request.dispose();
	}
});

test.beforeEach(async ({ page }) => {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Entrar' }).click();
	await page.waitForLoadState('networkidle');
	await expect(page).toHaveURL(/\/panel$/);
});

test('cada página del panel carga con su título y sin error de servidor', async ({ page }) => {
	for (const path of PANEL_PAGES) {
		const response = await page.goto(path);
		await page.waitForLoadState('networkidle');

		expect(response?.status(), path).toBeLessThan(500);
		await expect(page.locator('h1').first(), path).toBeVisible();
	}
});

test('el perfil pide el cambio de email con la contraseña y confirma el envío', async ({
	page
}) => {
	await page.goto('/panel/perfil');
	await page.waitForLoadState('networkidle');

	await page.getByLabel('Nuevo email').fill(uniqueGmail('nuevo'));
	await page.locator('#perfil-email-contrasena').fill(PASSWORD);
	await page.getByRole('button', { name: 'Enviar enlace de confirmación' }).click();
	await page.waitForLoadState('networkidle');

	await expect(page.getByText('Te hemos enviado un enlace a la nueva dirección.')).toBeVisible();
});

test('las páginas del panel no tienen fallos de accesibilidad', async ({ page }, testInfo) => {
	for (const path of PANEL_PAGES) {
		await page.goto(path);
		await page.waitForLoadState('networkidle');
		await checkAccessibility(page, testInfo);
	}
});
