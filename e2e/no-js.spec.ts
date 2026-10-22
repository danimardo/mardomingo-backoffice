// Flujos públicos sin JavaScript (T360; UX-16; constitución «Mejora progresiva»). Las páginas se leen y sus formularios se envían
// sin JavaScript. El captcha del registro es la única excepción permitida: sin él, el registro se rechaza y lo dice.
import { expect, test } from './fixtures';

test.use({ javaScriptEnabled: false });
test.use({ guardAllow: [/requestfailed: .*\(csp\)|status of 400|status of 401/] });

for (const route of ['/', '/precios', '/terminos', '/privacidad', '/cookies']) {
	test(`@critical @UX-16 ${route} se lee sin JavaScript`, async ({ page }) => {
		await page.goto(route);
		await expect(page.locator('h1').first()).toBeVisible();
	});
}

test('@critical el login sin JavaScript muestra su formulario y rechaza credenciales inválidas', async ({
	page
}) => {
	await page.goto('/login');
	await page.getByLabel('Email').fill('no-existe@ejemplo.es');
	await page.getByLabel('Contraseña', { exact: true }).fill('contraseña-incorrecta-123');
	await page.getByRole('button', { name: 'Entrar' }).click();

	await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
	await expect(page.locator('form').first()).toBeVisible();
});

test('@critical el registro sin JavaScript no crea la cuenta sin captcha y lo dice', async ({
	page
}) => {
	await page.goto('/registro');
	await page.getByLabel('Email').fill('nueva.persona@ejemplo.es');
	await page.getByLabel('Contraseña', { exact: true }).fill('contraseña-segura-123');
	await page.getByRole('button', { name: 'Crear cuenta' }).click();

	await expect(page.getByRole('heading', { name: 'Crear cuenta' })).toBeVisible();
});
