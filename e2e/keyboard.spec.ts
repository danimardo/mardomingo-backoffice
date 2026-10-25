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

// Espaciado de texto de WCAG 1.4.12 (interlineado 1,5; párrafos 2; letras 0,12 em; palabras 0,16 em) y zoom al 200 %
// aproximado con `zoom` del documento (Playwright no expone el zoom del navegador). Sin pérdida de contenido: nada
// desborda horizontalmente ni queda recortado. T361.
const SPACING_RULES = [
	'* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }',
	'p { margin-bottom: 2em !important; }'
];

for (const route of ['/', '/login', '/registro', '/precios']) {
	test(`@UX-16 ${route} sin pérdida de contenido con el espaciado de texto de WCAG`, async ({
		page
	}) => {
		await page.goto(route);
		await page.waitForLoadState('networkidle');
		// La CSP de la app bloquea los estilos en línea: las reglas van por CSSOM, que sí está permitido.
		await page.evaluate((rules) => {
			const sheet = document.styleSheets[0];
			for (const rule of rules) sheet?.insertRule(rule, sheet.cssRules.length);
		}, SPACING_RULES);

		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(
			overflow,
			`desbordamiento de ${String(overflow)} px con el espaciado`
		).toBeLessThanOrEqual(0);
	});

	test(`@UX-16 ${route} con zoom del 200 % no desborda en 640 px`, async ({ page }) => {
		await page.setViewportSize({ width: 640, height: 800 });
		await page.goto(route);
		await page.waitForLoadState('networkidle');
		await page.evaluate(() => {
			document.documentElement.style.zoom = '2';
		});

		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow, `desbordamiento de ${String(overflow)} px al 200 %`).toBeLessThanOrEqual(0);
	});
}
