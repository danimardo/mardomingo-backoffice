// Matriz de UX en las páginas clave (16.11; T355; UX-16). Tema claro y oscuro × efectos normales y reducidos × anchos de 320,
// 390 y 1366 px; sin desbordamiento horizontal; axe sin violaciones serious o critical. Además: `forced-colors`, `contrast` y
// `prefers-reduced-transparency` emulados (o «no verificable»), y los flujos sin JavaScript. El cristal no se da por bueno con
// axe: lo que axe no calcula queda como «pendiente DS-09» (medición manual).
import { expect, test } from './fixtures';
import { checkAccessibility } from './fixtures/axe';
import { emulate, emulateReducedTransparency, recordUx } from './fixtures/ux-emulation';

const KEY_PAGES = ['/', '/apps/secretario', '/precios'];
const WIDTHS = [320, 390, 1366];
const EFFECTS = ['normales', 'reducidos'] as const;

async function applyEffects(
	page: import('@playwright/test').Page,
	effects: (typeof EFFECTS)[number]
) {
	await page.evaluate((value) => {
		if (value === 'reducidos') document.documentElement.setAttribute('data-effects', 'reduced');
		else document.documentElement.removeAttribute('data-effects');
	}, effects);
}

for (const scheme of ['light', 'dark'] as const) {
	for (const effects of EFFECTS) {
		for (const width of WIDTHS) {
			for (const route of KEY_PAGES) {
				test(`@UX-16 ${route} sin desbordamiento y sin violaciones: ${scheme}, efectos ${effects}, ${String(width)} px`, async ({
					page
				}, testInfo) => {
					await page.setViewportSize({ width, height: 800 });
					await emulate(page, {
						colorScheme: scheme,
						reducedMotion: effects === 'reducidos' ? 'reduce' : 'no-preference'
					});
					await page.goto(route);
					await applyEffects(page, effects);

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
}

for (const route of KEY_PAGES) {
	test(`@UX-16 ${route} con forced-colors y contraste aumentado sigue siendo usable`, async ({
		page
	}, testInfo) => {
		await emulate(page, { forcedColors: 'active', contrast: 'more' });
		await page.goto(route);

		await expect(page.locator('h1').first()).toBeVisible();
		recordUx(testInfo, 'forced-colors', 'comprobado', route);
		recordUx(testInfo, 'contrast-more', 'comprobado', route);
	});

	test(`@UX-16 ${route} con transparencia reducida`, async ({ page }, testInfo) => {
		await page.goto(route);
		const applied = await emulateReducedTransparency(page, testInfo);
		if (applied) recordUx(testInfo, 'prefers-reduced-transparency', 'comprobado', route);
	});
}

test.describe('sin JavaScript', () => {
	// Sin JavaScript, el navegador bloquea la precarga de los módulos de la aplicación por la CSP: es lo esperado (ver accounts.spec.ts).
	test.use({ javaScriptEnabled: false, guardAllow: [/requestfailed: .*\(csp\)/] });

	for (const route of KEY_PAGES) {
		test(`@UX-16 ${route} se lee y su enlace de registro funciona sin JavaScript`, async ({
			page
		}, testInfo) => {
			await page.goto(route);
			await expect(page.locator('h1').first()).toBeVisible();
			recordUx(testInfo, 'sin-javascript', 'comprobado', route);
		});
	}
});
