// Matriz de UX de la compra W20 con sesión de `user` (T248; 16.11; UX-16). Tema claro y oscuro × efectos normales y reducidos
// × anchos de 320, 390 y 1366 px; sin desbordamiento horizontal y axe sin violaciones serious o critical. Misma regla que
// `e2e/ux-matrix.spec.ts`: lo que axe no calcula (el cristal) no se da por bueno. W21 necesita un pago concreto y queda en
// su propio E2E.
import { expect, test } from './fixtures';
import { checkAccessibility } from './fixtures/axe';
import { emulate } from './fixtures/ux-emulation';

const ROUTE = '/panel/comprar?paquete=pck_seed_5eur';
const WIDTHS = [320, 390, 1366];
const EFFECTS = ['normales', 'reducidos'] as const;

test.describe('matriz de UX de la compra (W20)', () => {
	test.use({ storageState: 'e2e/.auth/user.json' });

	for (const scheme of ['light', 'dark'] as const) {
		for (const effects of EFFECTS) {
			for (const width of WIDTHS) {
				test(`@UX-16 ${ROUTE} sin desbordamiento y sin violaciones: ${scheme}, efectos ${effects}, ${String(width)} px`, async ({
					page
				}, testInfo) => {
					await page.setViewportSize({ width, height: 800 });
					await emulate(page, {
						colorScheme: scheme,
						reducedMotion: effects === 'reducidos' ? 'reduce' : 'no-preference'
					});
					await page.goto(ROUTE);
					if (effects === 'reducidos') {
						await page.evaluate(() => {
							document.documentElement.setAttribute('data-effects', 'reduced');
						});
					}

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
