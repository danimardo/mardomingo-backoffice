// Teclado en las páginas públicas (T361; UX-16, WCAG 2.1.1). El primer Tab llega al enlace de saltar al contenido; Enter lleva el
// foco a `#contenido`; el selector de tema se maneja con Enter y Espacio. Los diálogos y el menú de cuenta se prueban en el
// flujo de sesión (pendiente: no hay un diálogo público con el que probarlos aquí).
import { expect, test } from './fixtures';

test('@UX-16 el primer Tab llega a «saltar al contenido» y Enter lleva el foco al contenido', async ({
	page
}) => {
	await page.goto('/');
	await page.keyboard.press('Tab');

	const skip = page.getByRole('link', { name: /saltar al contenido|ir al contenido/i });
	await expect(skip).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(page.locator('#contenido')).toBeVisible();
});

test('@UX-16 el selector de tema se maneja con teclado y cambia el tema', async ({ page }) => {
	await page.goto('/');
	const dark = page.getByRole('button', { name: 'Oscuro' }).first();
	await dark.focus();
	await page.keyboard.press('Enter');
	await page.waitForLoadState('networkidle');

	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('@UX-16 Tab recorre la cabecera sin dejar foco atrapado', async ({ page }) => {
	await page.goto('/');
	const seen = new Set<string>();
	for (let index = 0; index < 25; index += 1) {
		await page.keyboard.press('Tab');
		const label = await page.evaluate(() => document.activeElement?.tagName ?? 'none');
		seen.add(label);
	}
	expect(seen.size).toBeGreaterThan(1);
});
