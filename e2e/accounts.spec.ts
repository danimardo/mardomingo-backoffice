// Cuentas en el navegador (T112; BE-FR-01, 03, 05; contracts/web-routes.md W08–W15, W19). Sin captcha real en el entorno
// de test: el registro se prueba hasta el rechazo del captcha, que es el comportamiento esperado sin token.
import { expect, test } from './fixtures';

// Las respuestas 400 y 401 de estas pruebas son el resultado esperado (validación y credenciales), no un fallo.
// Una petición de datos de SvelteKit (`__data.json`) puede quedar abortada al navegar (ver `privacy.spec.ts`): no es un fallo.
test.use({ guardAllow: [/status of 400|status of 401|__data\.json.*ERR_ABORTED/] });

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

test('@critical [UX-01] el registro sin captcha no crea la cuenta, conserva el email y lleva el foco al resumen', async ({
	page
}) => {
	await page.goto('/registro');
	await page.waitForLoadState('networkidle');
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
	await expect(page.getByRole('alert')).toBeFocused();
	await expect(page.getByLabel('Email')).toHaveValue('nueva.persona@ejemplo.es');
	await expect(page.getByLabel('Contraseña', { exact: true })).toHaveValue('');
	await expect(page.getByRole('heading', { name: 'Revisa tu email' })).toHaveCount(0);
});

test('@critical [UX-04] el inicio de sesión con datos erróneos da un error genérico', async ({
	page
}) => {
	await page.goto('/login');
	// Esperar a que la página esté lista antes de rellenar: si no, el envío puede ir antes de hidratar y no aparece el error.
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Email').fill('nadie@ejemplo.es');
	await page.getByLabel('Contraseña', { exact: true }).fill('mal-escrita');

	await page.getByRole('button', { name: 'Entrar' }).click();
	// Sacar el ratón del botón: el mismo botón dispara la precarga de __data.json al pasar por encima (trampa de hover).
	await page.mouse.move(0, 0);
	await page.waitForLoadState('networkidle');

	await expect(page.getByRole('alert')).toContainText('Email o contraseña incorrectos.');
});

test('@critical la recuperación responde lo mismo exista o no el email', async ({ page }) => {
	await page.goto('/recuperar');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Email').fill('nadie@ejemplo.es');

	// La respuesta de __data.json del envío debe completarse antes de terminar: si la prueba acaba antes, la petición se aborta.
	const invalidated = page.waitForResponse((response) => response.url().includes('__data.json'));
	await page.getByRole('button', { name: 'Enviar el enlace' }).click();
	await invalidated;
	// Sacar el ratón del botón antes de esperar (trampa de hover, igual que en el inicio de sesión).
	await page.mouse.move(0, 0);
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

test.describe('320 px sin desplazamiento horizontal', () => {
	for (const path of ['/login', '/registro', '/recuperar']) {
		test(`@critical ${path} cabe en 320 px de ancho`, async ({ page }) => {
			await page.setViewportSize({ width: 320, height: 640 });
			await page.goto(path);

			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth
			);
			// Si falla, el mensaje dice qué elementos sobresalen (diagnóstico para entornos con otras fuentes, como el CI).
			const offenders = await page.evaluate(() =>
				Array.from(document.querySelectorAll('body *'))
					.map((el) => ({ el, right: el.getBoundingClientRect().right }))
					.filter(({ right }) => right > document.documentElement.clientWidth + 0.5)
					.slice(0, 8)
					.map(
						({ el, right }) =>
							`${el.tagName.toLowerCase()} ${el.className.slice(0, 40)} right=${Math.round(right).toString()}`
					)
			);
			expect(overflow, offenders.join(' | ')).toBeLessThanOrEqual(0);
		});
	}
});
