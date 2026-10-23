// Accesibilidad del panel con sesión de `user` (T273; 16.11; UX-16): todas las páginas del panel en ambos temas con axe, y la
// matriz de 16.11 en el saldo (página clave de 16.8): claro y oscuro × efectos normales y reducidos × 320, 390 y 1366 px.
// El cristal de la tarjeta de saldo no se da por bueno con axe: queda como «pendiente DS-09» (medición manual).
import { expect, test } from './fixtures';
import { checkAccessibility } from './fixtures/axe';

const PANEL_ROUTES = [
	'/panel',
	'/panel/consumo',
	'/panel/movimientos',
	'/panel/apps',
	'/panel/facturas',
	'/panel/sesiones',
	'/panel/perfil',
	'/panel/perfil/borrar',
	'/panel/comprar'
];

test.describe('accesibilidad del panel', () => {
	test.use({ storageState: 'e2e/.auth/user.json' });

	for (const scheme of ['light', 'dark'] as const) {
		for (const route of PANEL_ROUTES) {
			test(`accesible sin violaciones serious o critical en ${route} con tema ${scheme}`, async ({
				page
			}, testInfo) => {
				await page.emulateMedia({ colorScheme: scheme });
				await page.goto(route);

				await checkAccessibility(page, testInfo);
			});
		}
	}
});

test.describe('matriz de UX del saldo del panel (16.11)', () => {
	test.use({ storageState: 'e2e/.auth/user.json' });

	for (const scheme of ['light', 'dark'] as const) {
		for (const effects of ['normales', 'reducidos'] as const) {
			for (const width of [320, 390, 1366]) {
				test(`@UX-16 /panel sin desbordamiento y sin violaciones: ${scheme}, efectos ${effects}, ${String(width)} px`, async ({
					page
				}, testInfo) => {
					await page.setViewportSize({ width, height: 800 });
					await page.emulateMedia({
						colorScheme: scheme,
						reducedMotion: effects === 'reducidos' ? 'reduce' : 'no-preference'
					});
					await page.goto('/panel');
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
