// Humo de la aplicación (T-PLAY-002): la página principal responde, el marco aparece con los estilos cargados,
// hay navegación cliente y no hay excepciones, `console.error` ni errores de hidratación.
import { expect, test } from './fixtures';

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
	await page.evaluate(() => {
		window.__sinRecarga = true;
	});

	await page.locator('header a.brand').click();

	await expect(page).toHaveURL('/');
	const kept = await page.evaluate(() => window.__sinRecarga === true);
	expect(kept).toBe(true);
});
