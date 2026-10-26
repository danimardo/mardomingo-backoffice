// Regresión visual (T367; R09; 16.11). Solo corre en el proyecto `visual` y, por norma, dentro del contenedor oficial de
// Playwright: las líneas base se generan allí (`pnpm test:e2e:visual`), nunca en Windows. Desviación de nombre: el proyecto
// `visual` solo recoge ficheros `*.visual.ts`, así que este fichero se llama `capturas.visual.ts` en lugar de `visual.spec.ts`.
import { expect, test } from './fixtures';

const CAPTURES = [
	{ name: 'landing', route: '/', scheme: 'light' },
	{ name: 'landing-oscuro', route: '/', scheme: 'dark' },
	{ name: 'login', route: '/login', scheme: 'light' },
	{ name: 'login-oscuro', route: '/login', scheme: 'dark' }
] as const;

for (const capture of CAPTURES) {
	test(`captura ${capture.name} sin cambios visuales`, async ({ page }) => {
		await page.emulateMedia({ colorScheme: capture.scheme, reducedMotion: 'reduce' });
		await page.goto(capture.route);
		await expect(page).toHaveScreenshot(`${capture.name}.png`, {
			fullPage: true,
			animations: 'disabled'
		});
	});
}

test('captura landing en móvil sin cambios visuales', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
	await page.goto('/');
	await expect(page).toHaveScreenshot('landing-movil.png', {
		fullPage: true,
		animations: 'disabled'
	});
});

test.describe('panel y administración con sesión', () => {
	test.describe('usuario', () => {
		test.use({ storageState: 'e2e/.auth/user.json' });

		test('captura saldo del panel sin cambios visuales', async ({ page }) => {
			await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
			await page.goto('/panel');
			await expect(page).toHaveScreenshot('panel-saldo.png', {
				fullPage: true,
				animations: 'disabled'
			});
		});

		test('captura compra sin cambios visuales', async ({ page }) => {
			await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
			await page.goto('/panel/comprar?paquete=pck_seed_5eur');
			await expect(page).toHaveScreenshot('compra.png', {
				fullPage: true,
				animations: 'disabled'
			});
		});
	});

	test.describe('administrador', () => {
		test.use({ storageState: 'e2e/.auth/admin.json' });

		test('captura estadísticas sin cambios visuales en oscuro', async ({ page }) => {
			await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
			await page.goto('/admin/estadisticas');
			await expect(page).toHaveScreenshot('admin-estadisticas-oscuro.png', {
				fullPage: true,
				animations: 'disabled'
			});
		});
	});
});
