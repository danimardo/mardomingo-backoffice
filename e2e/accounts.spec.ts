// Cuentas en el navegador (T112; BE-FR-01, 03, 05; contracts/web-routes.md W08–W15, W19). Sin captcha real en el entorno
// de test: el registro se prueba hasta el rechazo del captcha, que es el comportamiento esperado sin token.
import { expect, test } from './fixtures';

// Las respuestas 400 y 401 de estas pruebas son el resultado esperado (validación y credenciales), no un fallo.
test.use({ guardAllow: [/status of 400|status of 401/] });

test('@critical el panel sin sesión manda al inicio de sesión con el destino guardado', async ({
	page
}) => {
	await page.goto('/panel');

	await expect(page).toHaveURL(/\/login\?redirectTo=%2Fpanel/);
	await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
});

test('@critical el registro muestra los campos y ninguna casilla premarcada', async ({ page }) => {
	await page.goto('/registro');

	await expect(page.getByRole('heading', { name: 'Crear cuenta' })).toBeVisible();
	await expect(page.getByLabel('Email')).toBeVisible();
	await expect(page.getByLabel('Contraseña', { exact: true })).toBeVisible();
	for (const name of ['acceptTerms', 'acceptPrivacy', 'acceptAup', 'ageDeclaration']) {
		await expect(page.locator(`input[name="${name}"]`)).not.toBeChecked();
	}
});

test('@critical el registro sin captcha no crea la cuenta y lo dice', async ({ page }) => {
	await page.goto('/registro');
	await page.getByLabel('Email').fill('nueva.persona@ejemplo.es');
	await page.getByLabel('Contraseña', { exact: true }).fill('contraseña-larga-123');
	for (const name of ['acceptTerms', 'acceptPrivacy', 'acceptAup', 'ageDeclaration']) {
		await page.locator(`input[name="${name}"]`).check();
	}

	await page.getByRole('button', { name: 'Crear cuenta' }).click();
	await page.waitForLoadState('networkidle');

	await expect(page.getByRole('alert')).toContainText(
		'No hemos podido comprobar que eres una persona'
	);
	await expect(page.getByRole('heading', { name: 'Revisa tu email' })).toHaveCount(0);
});

test('@critical el inicio de sesión con datos erróneos da un error genérico', async ({ page }) => {
	await page.goto('/login');
	await page.getByLabel('Email').fill('nadie@ejemplo.es');
	await page.getByLabel('Contraseña', { exact: true }).fill('mal-escrita');

	await page.getByRole('button', { name: 'Entrar' }).click();
	await page.waitForLoadState('networkidle');

	await expect(page.getByRole('alert')).toContainText('Email o contraseña incorrectos.');
});

test('@critical la recuperación responde lo mismo exista o no el email', async ({ page }) => {
	await page.goto('/recuperar');
	await page.getByLabel('Email').fill('nadie@ejemplo.es');

	await page.getByRole('button', { name: 'Enviar el enlace' }).click();
	await page.waitForLoadState('networkidle');

	await expect(page.getByRole('status')).toContainText('Si la cuenta existe');
});

test('@critical un enlace de verificación inventado se explica y ofrece otro', async ({ page }) => {
	await page.goto('/verificar?token=token-inventado');

	await expect(page.getByRole('status')).toContainText('Este enlace no es válido');
	await expect(page.getByRole('link', { name: 'Pedir un enlace nuevo' })).toHaveAttribute(
		'href',
		'/verificar/reenviar'
	);
});

test.describe('sin JavaScript', () => {
	// Sin JavaScript el navegador aún pide las precargas de los módulos y la CSP las bloquea: no afecta a la página.
	test.use({ javaScriptEnabled: false, guardAllow: [/requestfailed: .*\(csp\)/] });

	test('el registro sin JavaScript muestra el aviso del captcha', async ({ page }) => {
		await page.goto('/registro');

		expect(await page.content()).toContain('Para crear la cuenta necesitas JavaScript');
	});
});
