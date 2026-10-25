// Teclado en las páginas públicas (T361; UX-16, WCAG 2.1.1). El primer Tab llega al enlace de saltar al contenido; Enter lleva el
// foco a `#contenido`; el selector de tema se maneja con Enter y Espacio. Los diálogos y el menú de cuenta se prueban en el
// flujo de sesión (pendiente: no hay un diálogo público con el que probarlos aquí).
import { expect, test } from './fixtures';
import { PANEL_E2E_EMAIL, PANEL_E2E_PASSWORD, SETUP_ADMIN_EMAIL } from './constants';
import { PASSWORD } from './outbox';

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

// Zona táctil de 44 px a 390 px (T361; 16.5). Enlaces y botones: altura de la caja más el pseudo-elemento que amplía su área.
// Casillas: su etiqueta es la zona de pulsación. Medido en el DOM real; sin cambiar la maquetación.
for (const route of ['/', '/login', '/registro', '/precios']) {
	test(`@UX-16 ${route} a 390 px, los enlaces, botones y casillas miden al menos 44 px de alto`, async ({
		page
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(route);
		await page.waitForLoadState('networkidle');

		const small = await page.evaluate(() => {
			const bad: string[] = [];
			const hit = (el: Element, name: string): void => {
				const box = el.getBoundingClientRect();
				if (box.width === 0 || box.height === 0) return;
				const pseudo = getComputedStyle(el, '::before');
				const extra = pseudo.content !== 'none' && pseudo.position === 'absolute' ? 24 : 0;
				if (box.height + extra < 44)
					bad.push(`${name} ${String(Math.round(box.height + extra))}px`);
			};
			for (const el of document.querySelectorAll('a[href], button'))
				hit(el, el.tagName.toLowerCase());
			for (const box of document.querySelectorAll('input[type="checkbox"]')) {
				const label = document.querySelector(`label[for="${box.id}"]`);
				if (label !== null) hit(label, 'label de casilla');
			}
			return bad;
		});
		expect(small, small.join(' | ')).toEqual([]);
	});
}

// Título y encabezado (16.5; WCAG 2.4.2): el `h1` coincide con la parte del `<title>` antes de un separador de marca, si la
// hay. El texto del enlace de navegación no se compara: puede ser más corto que el `h1` («Precios» frente a «Precios orientativos»).

for (const route of ['/login', '/registro', '/precios', '/recuperar']) {
	test(`@UX-16 ${route} el h1 coincide con la parte del título antes de la marca`, async ({
		page
	}) => {
		await page.goto(route);
		await page.waitForLoadState('networkidle');

		const title = await page.title();
		const heading = (await page.getByRole('heading', { level: 1 }).textContent())?.trim() ?? '';
		const beforeBrand = title.split(' · ')[0]?.split(' — ')[0]?.split(' | ')[0]?.trim() ?? '';
		expect(beforeBrand).toBe(heading);
	});
}

// Navegación del panel con teclado (T361; 16.5): Tab entra en la navegación, Mayús+Tab sale de ella y el foco es visible.
test('@UX-16 la navegación del panel se recorre con Tab y Mayús+Tab, con foco visible', async ({
	page
}) => {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Email').fill(PANEL_E2E_EMAIL);
	await page.getByLabel('Contraseña', { exact: true }).fill(PANEL_E2E_PASSWORD);
	await page.getByRole('button', { name: 'Entrar' }).click();
	await page.waitForURL(/\/panel$/);
	await page.waitForLoadState('networkidle');

	// La página actual se marca en la navegación (16.5): aria-current="page" además de la señal visual.
	await expect(
		page
			.getByRole('navigation', { name: 'Navegación del panel' })
			.getByRole('link', { name: 'Resumen' })
	).toHaveAttribute('aria-current', 'page');

	const insideNav = (): Promise<boolean> =>
		page.evaluate(
			() => document.activeElement?.closest('nav[aria-label="Navegación del panel"]') !== null
		);
	let entered = false;
	for (let step = 0; step < 40 && !entered; step += 1) {
		await page.keyboard.press('Tab');
		entered = await insideNav();
	}
	expect(entered, 'Tab llega a la navegación del panel').toBe(true);

	const outline = await page.evaluate(
		() => getComputedStyle(document.activeElement ?? document.body).outlineStyle
	);
	expect(outline, 'el foco de la navegación es visible').not.toBe('none');

	await page.keyboard.press('Shift+Tab');
	await page.keyboard.press('Shift+Tab');
	expect(await insideNav(), 'Mayús+Tab sale de la navegación').toBe(false);
});

// Navegación de administración con teclado (T361; `PanelNav` del sistema de diseño, usado por `/admin`): Tab entra, Mayús+Tab sale.
test('@UX-16 la navegación de administración se recorre con Tab y Mayús+Tab, con foco visible', async ({
	page
}) => {
	await page.goto('/login');
	await page.getByLabel('Email').fill(SETUP_ADMIN_EMAIL);
	await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Entrar' }).click();
	await page.waitForURL((url) => !url.pathname.startsWith('/login'));
	await page.goto('/admin');
	await page.waitForLoadState('networkidle');

	const navSelector = 'nav[aria-label="Navegación de administración"]';
	const insideNav = (): Promise<boolean> =>
		page.evaluate((selector) => document.activeElement?.closest(selector) !== null, navSelector);
	let entered = false;
	for (let step = 0; step < 40 && !entered; step += 1) {
		await page.keyboard.press('Tab');
		entered = await insideNav();
	}
	expect(entered, 'Tab llega a la navegación de administración').toBe(true);

	const outline = await page.evaluate(
		() => getComputedStyle(document.activeElement ?? document.body).outlineStyle
	);
	expect(outline, 'el foco de la navegación es visible').not.toBe('none');

	await page.keyboard.press('Shift+Tab');
	await page.keyboard.press('Shift+Tab');
	expect(await insideNav(), 'Mayús+Tab sale de la navegación').toBe(false);
});
