// Compra de créditos W20 (T247; BE-FR-25, BE-FR-74; crítico 10 sin JavaScript; 16.6 «Compra»). Con la cuenta `user`
// verificada: la lista de paquetes sin ninguno preseleccionado, el paso de confirmación con la renuncia sin marcar y el
// mismo formulario sin JavaScript. El crítico 4 completo (compra con renuncia, saldo y doble envío) está en
// `e2e/sesion.spec.ts`.
import { expect, test } from './fixtures';

test.describe('compra con sesión de usuario', () => {
	test.use({ storageState: 'e2e/.auth/user.json' });

	test('@BE-FR-25 sin paquete preseleccionado la página lista los paquetes y no muestra confirmación', async ({
		page
	}) => {
		await page.goto('/panel/comprar');

		await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
		await expect(page.getByText('Pack 5').first()).toBeVisible();
		await expect(page.locator('input[name="waiverAccepted"]')).toHaveCount(0);
	});

	test('@BE-FR-25 @UX-05 el paso de confirmación muestra la casilla de renuncia sin marcar', async ({
		page
	}) => {
		await page.goto('/panel/comprar?paquete=pck_seed_5eur');

		const waiver = page.getByRole('checkbox').first();
		await expect(waiver).toBeVisible();
		await expect(waiver).not.toBeChecked();
	});

	test('@BE-FR-25 @UX-06 el paso de confirmación se ve en móvil 390×844 sin desbordamiento horizontal', async ({
		page
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('/panel/comprar?paquete=pck_seed_5eur');

		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth > document.documentElement.clientWidth
		);
		expect(overflow).toBe(false);
	});
});

test.describe('compra sin JavaScript (crítico 10)', () => {
	test.use({
		storageState: 'e2e/.auth/user.json',
		javaScriptEnabled: false,
		guardAllow: [/requestfailed: .*\(csp\)/]
	});

	test('@BE-FR-25 con JavaScript desactivado la confirmación sigue visible y la casilla no viene marcada', async ({
		page
	}) => {
		await page.goto('/panel/comprar?paquete=pck_seed_5eur');

		await expect(page.getByRole('checkbox').first()).not.toBeChecked();
	});
});
