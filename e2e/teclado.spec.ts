// Teclado en las páginas de la cuenta (T113; WCAG 2.1.1): el login se recorre con Tab hasta «Entrar» y se envía con
// Enter, y la casilla del registro se marca con la barra espaciadora. Sin ratón.
import { expect, test } from './fixtures';

test.describe('teclado', () => {
	// El login con datos erróneos responde 401 a propósito; el navegador lo registra como error de consola.
	test.use({ guardAllow: [/status of 401/] });

	test('el login se recorre con Tab hasta «Entrar» y se envía con Enter', async ({ page }) => {
		await page.goto('/login');
		await page.getByLabel('Email').fill('nadie@ejemplo.es');
		await page.getByLabel('Contraseña', { exact: true }).fill('mal-escrita');
		await page.getByLabel('Contraseña', { exact: true }).focus();

		const submit = page.getByRole('button', { name: 'Entrar' });
		for (let step = 0; step < 6; step += 1) {
			if (await submit.evaluate((element) => element === document.activeElement)) break;
			await page.keyboard.press('Tab');
		}
		await expect(submit).toBeFocused();

		await page.keyboard.press('Enter');
		await expect(page.getByText('Email o contraseña incorrectos.')).toBeVisible();
	});

	test('la casilla del registro se marca con la barra espaciadora', async ({ page }) => {
		await page.goto('/registro');
		const first = page.getByRole('checkbox').first();

		await first.focus();
		await page.keyboard.press('Space');

		await expect(first).toBeChecked();
	});
});
