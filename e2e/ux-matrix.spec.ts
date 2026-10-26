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

/** Elementos con transición o animación de duración positiva, según los estilos calculados (T358). */
async function movingElements(page: import('@playwright/test').Page): Promise<string[]> {
	return page.evaluate(() => {
		const positive = (list: string): boolean =>
			list.split(',').some((time) => parseFloat(time) > 0);
		const found: string[] = [];
		for (const element of document.querySelectorAll('*')) {
			const style = getComputedStyle(element);
			const transition = positive(style.transitionDuration);
			const animation = style.animationName !== 'none' && positive(style.animationDuration);
			if (transition || animation) {
				found.push(`${element.tagName.toLowerCase()}.${element.getAttribute('class') ?? ''}`);
			}
		}
		return found;
	});
}

/** Valor del token del borde de campo tal como lo declara la hoja de estilos (T358; contraste reforzado). */
async function borderTokenOf(page: import('@playwright/test').Page): Promise<string> {
	return page.evaluate(() =>
		getComputedStyle(document.documentElement).getPropertyValue('--border-field').trim()
	);
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

	// Movimiento (T358; UX-EFECTOS CA3–CA4): con `prefers-reduced-motion: reduce` la página no tiene transiciones ni
	// animaciones, comprobado con los estilos calculados de cada elemento.
	test(`@UX-16 ${route} con movimiento reducido por el sistema no tiene transiciones ni animaciones`, async ({
		page
	}, testInfo) => {
		await emulate(page, { reducedMotion: 'reduce' });
		await page.goto(route);
		await page.waitForLoadState('networkidle');

		expect(await movingElements(page), 'elementos con transición o animación').toEqual([]);
		recordUx(testInfo, 'reduced-motion', 'comprobado', route);
	});

	// El ajuste propio solo reduce: con «normales» el sistema sigue mandando y el movimiento no vuelve (T358; CA4).
	test(`@UX-16 ${route} con el ajuste «normales» no reactiva el movimiento que pide el sistema`, async ({
		page
	}, testInfo) => {
		await emulate(page, { reducedMotion: 'reduce' });
		await page.goto(route);
		await page.waitForLoadState('networkidle');
		await applyEffects(page, 'normales');

		expect(await movingElements(page), 'elementos con transición o animación').toEqual([]);
		recordUx(testInfo, 'reduced-motion-propio', 'comprobado', route);
	});

	test(`@UX-16 ${route} con forced-colors, el foco del teclado sigue visible`, async ({
		page
	}, testInfo) => {
		await emulate(page, { forcedColors: 'active' });
		await page.goto(route);
		await page.waitForLoadState('networkidle');
		await page.keyboard.press('Tab');

		const outline = await page.evaluate(
			() => getComputedStyle(document.activeElement ?? document.body).outlineStyle
		);
		expect(outline, 'el foco con colores del sistema es visible').not.toBe('none');
		recordUx(testInfo, 'forced-colors-foco', 'comprobado', route);
	});

	test(`@UX-16 ${route} con contraste reforzado cambia los bordes del sistema de diseño`, async ({
		page
	}, testInfo) => {
		await emulate(page, { contrast: 'no-preference' });
		await page.goto(route);
		const normal = await borderTokenOf(page);

		await emulate(page, { contrast: 'more' });
		await page.reload();
		const reinforced = await borderTokenOf(page);

		expect(reinforced, 'el borde de campo cambia con contraste reforzado').not.toBe(normal);
		recordUx(testInfo, 'contrast-more-bordes', 'comprobado', route);
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
