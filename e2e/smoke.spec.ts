// Humo de la aplicación (T-PLAY-002): la página principal responde, el marco aparece con los estilos cargados,
// hay navegación cliente y no hay excepciones, `console.error` ni errores de hidratación.
import { expect, test } from './fixtures';
import { LOCAL_WEB_ORIGIN } from './constants';

test('@smoke la página principal tiene contenido, marco y estilos del tema', async ({ page }) => {
	const response = await page.goto('/');

	expect(response?.status()).toBe(200);
	await expect(page.locator('main#contenido')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeAttached();
	const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
	expect(background).not.toBe('');
	const scheme = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
	expect(scheme).toContain('light');
});

test('@smoke la navegación cliente vuelve a la portada sin recargar la página', async ({
	page
}) => {
	await page.goto('/preferencias');
	await page.waitForLoadState('networkidle');
	await page.evaluate(() => {
		window.__sinRecarga = true;
	});

	await page.locator('header a.brand').click();

	await expect(page).toHaveURL('/');
	const kept = await page.evaluate(() => window.__sinRecarga === true);
	expect(kept).toBe(true);
});

// Contra un despliegue (`E2E_BASE_URL`) no hay cuentas de prueba: el humo solo lee la portada y el health.
test('@smoke GET /api/v1/health responde 200 con estado ok', async ({ request }) => {
	const response = await request.get('/api/v1/health');

	expect(response.status()).toBe(200);
	expect(await response.json()).toEqual({ status: 'ok' });
});

test.describe('humo con sesión de usuario', () => {
	// Se decide con la URL de la ejecución (fixture `baseURL`), no con el entorno: los specs no leen `process.env`.
	test.skip(
		({ baseURL }) => baseURL !== LOCAL_WEB_ORIGIN,
		'sin cuentas de prueba en un despliegue: el humo con sesión corre solo en local'
	);
	test.use({ storageState: 'e2e/.auth/user.json' });

	test('@smoke el usuario verificado entra al panel con su sesión ya iniciada', async ({
		page
	}) => {
		const response = await page.goto('/panel');

		expect(response?.status()).toBe(200);
		await expect(page.locator('main#contenido')).toBeVisible();
		await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
	});
});
