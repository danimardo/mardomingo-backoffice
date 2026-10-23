// Matriz de UX del resultado de una compra W21 `/panel/comprar/[paymentId]` (T248; 16.11; UX-16) con la cuenta `user`. Antes de
// la matriz, un `beforeAll` hace una compra real en el simulador (con su renuncia) y guarda la página de su resultado. Tema
// claro y oscuro × efectos normales y reducidos × 320, 390 y 1366 px; sin desbordamiento y con axe sin violaciones serious o
// critical.
import { expect, test } from './fixtures';
import { checkAccessibility } from './fixtures/axe';
import { emulate } from './fixtures/ux-emulation';

let paymentPath = '';

test.beforeAll(async ({ browser, baseURL }) => {
	const context = await browser.newContext({
		baseURL: baseURL ?? 'http://localhost:7390',
		storageState: 'e2e/.auth/user.json'
	});
	try {
		const page = await context.newPage();
		await page.goto('/panel/comprar?paquete=pck_seed_5eur');
		await page.getByLabel(/renuncio a mi derecho de desistimiento/).check();
		await page.getByRole('button', { name: /Comprar 5,00\s€ de créditos/ }).click();
		await expect(page).toHaveURL(/\/panel\/comprar\/pay_/);
		paymentPath = new URL(page.url()).pathname;
	} finally {
		await context.close();
	}
});

test.describe('matriz de UX del resultado de la compra (W21)', () => {
	test.use({ storageState: 'e2e/.auth/user.json' });

	for (const scheme of ['light', 'dark'] as const) {
		for (const effects of ['normales', 'reducidos'] as const) {
			for (const width of [320, 390, 1366]) {
				test(`@UX-16 /panel/comprar/[paymentId] sin desbordamiento y sin violaciones: ${scheme}, efectos ${effects}, ${String(width)} px`, async ({
					page
				}, testInfo) => {
					await page.setViewportSize({ width, height: 800 });
					await emulate(page, {
						colorScheme: scheme,
						reducedMotion: effects === 'reducidos' ? 'reduce' : 'no-preference'
					});
					await page.goto(paymentPath);
					if (effects === 'reducidos') {
						await page.evaluate(() => {
							document.documentElement.setAttribute('data-effects', 'reduced');
						});
					}
					await expect(page.getByRole('heading', { name: 'Resultado de la compra' })).toBeVisible();

					const overflow = await page.evaluate(
						() => document.documentElement.scrollWidth - document.documentElement.clientWidth
					);
					expect(
						overflow,
						`desbordamiento horizontal de ${String(overflow)} px`
					).toBeLessThanOrEqual(0);

					await checkAccessibility(page, testInfo);
				});
			}
		}
	}
});
