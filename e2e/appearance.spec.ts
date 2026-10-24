// Apariencia y accesibilidad de la interfaz (T054; UX-TEMA CA1–CA5; UX-EFECTOS CA1–CA4; V08; SC-017).
// Con JavaScript desactivado el tema se decide solo en el servidor. Con JavaScript, el cambio del sistema se
// aplica sin recargar. Las comprobaciones que el navegador no puede dar se anotan como «no verificable».
import { expect, test } from './fixtures';
import { emulate, emulateReducedTransparency, recordUx } from './fixtures/ux-emulation';

// Sin JavaScript, Chromium intenta precargar los módulos de la aplicación y la CSP los bloquea. Esos módulos no
// se necesitan sin JS: el aviso se acepta solo en estas pruebas, no en las que usan JavaScript.
const PRELOAD_CSP = /requestfailed: .*\(csp\)/;

const WIDTHS = [320, 390, 1366];

test.describe('tema sin JavaScript (UX-TEMA CA1 y CA3)', () => {
	test.use({ javaScriptEnabled: false, colorScheme: 'light', guardAllow: [PRELOAD_CSP] });

	test('[UX-TEMA/CA1] sin cookie, el HTML no lleva data-theme: el sistema decide desde la primera pintura', async ({
		page
	}) => {
		const response = await page.goto('/');
		const html = (await response?.text()) ?? '';

		expect(html).not.toContain('data-theme=');
		expect(html).toContain('<html lang="es"');
	});

	test('[UX-TEMA/CA3] con la cookie «oscuro», el servidor pinta data-theme="dark" en la primera respuesta', async ({
		page,
		context
	}) => {
		await context.addCookies([{ name: 'mdm_theme', value: 'dark', url: 'http://localhost:7390' }]);

		const response = await page.goto('/');

		expect((await response?.text()) ?? '').toContain('data-theme="dark"');
	});
});

test.describe('elegir tema y efectos con JavaScript', () => {
	test('[UX-TEMA/CA3] «Oscuro» guarda la cookie y la página cambia sin recargar', async ({
		page,
		browserName
	}, testInfo) => {
		// WebKit no envía cookies `Secure` sobre http://localhost (en producción el sitio es https): esta
		// comprobación de ida y vuelta solo es válida en Chromium y Firefox aquí.
		if (browserName === 'webkit') {
			recordUx(
				testInfo,
				'cookie Secure en ida y vuelta',
				'no verificable',
				'WebKit no la envía sobre http; se verifica en https'
			);
			test.skip(true, 'WebKit no envía cookies Secure sobre http');
		}
		await page.goto('/preferencias');
		await page.evaluate(() => {
			window.__sinRecarga = true;
		});

		await page.locator('#contenido').getByRole('button', { name: 'Oscuro' }).click();

		await expect(
			page.locator('#contenido').getByRole('button', { name: 'Oscuro' })
		).toHaveAttribute('aria-pressed', 'true');
		const kept = await page.evaluate(() => window.__sinRecarga === true);
		expect(kept).toBe(true);
		// La acción del tema pide datos a SvelteKit; se espera a que terminen antes de cerrar la prueba.
		await page.waitForLoadState('networkidle');
		const cookies = await page.context().cookies();
		expect(cookies.find((c) => c.name === 'mdm_theme')?.value).toBe('dark');
		recordUx(testInfo, 'tema elegido sin recargar', 'comprobado');
	});

	test('[UX-TEMA/CA2] con «Sistema», cambiar el sistema en /login no borra lo escrito', async ({
		page
	}) => {
		await emulate(page, { colorScheme: 'light' });
		await page.goto('/login');
		await page.getByLabel('Email').fill('texto que no se pierde');
		await page.evaluate(() => {
			window.__sinRecarga = true;
		});
		const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

		await emulate(page, { colorScheme: 'dark' });

		const after = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
		expect(after).not.toBe(before);
		expect(await page.getByLabel('Email').inputValue()).toBe('texto que no se pierde');
		expect(await page.evaluate(() => window.__sinRecarga === true)).toBe(true);
	});

	test('[UX-TEMA/CA2] con «Sistema», cambiar el sistema cambia la página sin recargar', async ({
		page
	}) => {
		await emulate(page, { colorScheme: 'light' });
		await page.goto('/preferencias');
		await page.evaluate(() => {
			window.__sinRecarga = true;
		});
		const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

		await emulate(page, { colorScheme: 'dark' });

		const after = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
		expect(after).not.toBe(before);
		const kept = await page.evaluate(() => window.__sinRecarga === true);
		expect(kept).toBe(true);
	});

	test('[UX-EFECTOS/CA2] efectos reducidos hacen opacas las superficies de cristal', async ({
		page
	}) => {
		await page
			.context()
			.addCookies([{ name: 'mdm_effects', value: 'reduced', url: 'http://localhost:7390' }]);
		await page.goto('/');

		const header = await page
			.locator('header')
			.evaluate((el) => getComputedStyle(el).backgroundColor);
		expect(header).not.toMatch(/rgba\(.*,\s*0?\.\d+\)/);
		expect(await page.locator('html').getAttribute('data-effects')).toBe('reduced');
	});

	test('reducir movimiento, contraste y colores forzados no rompen la página', async ({ page }) => {
		await emulate(page, { reducedMotion: 'reduce', contrast: 'more', forcedColors: 'active' });

		const response = await page.goto('/preferencias');

		expect(response?.status()).toBe(200);
		await expect(page.locator('#contenido').getByRole('group', { name: 'Tema' })).toBeVisible();
	});

	test('prefers-reduced-transparency por CDP o «no verificable»', async ({ page }, testInfo) => {
		await page.goto('/');
		const applied = await emulateReducedTransparency(page, testInfo);

		if (applied) {
			recordUx(testInfo, 'prefers-reduced-transparency', 'comprobado');
		}
	});
});

test.describe('formularios sin JavaScript (UX-TEMA CA y mejora progresiva)', () => {
	test.use({ javaScriptEnabled: false, guardAllow: [PRELOAD_CSP] });

	// WebKit no acepta una cookie `Secure` en http://localhost (la app va por https en producción): la prueba queda fuera de WebKit.
	test('[UX-TEMA/CA4] «Claro» sin JavaScript guarda la cookie y vuelve a la página', async ({
		page,
		browserName
	}) => {
		test.skip(
			browserName === 'webkit',
			'WebKit no guarda cookies Secure en http://localhost (ver comentario)'
		);
		await page.goto('/preferencias');

		await page.locator('#contenido').getByRole('button', { name: 'Claro' }).click();

		await expect(page).toHaveURL('/preferencias');
		const cookies = await page.context().cookies();
		expect(cookies.find((c) => c.name === 'mdm_theme')?.value).toBe('light');
	});
});

test.describe('anchos de pantalla (16.5)', () => {
	// La página de error responde 404 a propósito: no es un fallo de la prueba.
	test.use({ guardAllow: [/status of 404/] });

	for (const width of WIDTHS) {
		test(`sin desplazamiento horizontal a ${String(width)} px en la portada y en el error`, async ({
			page
		}) => {
			await page.setViewportSize({ width, height: 800 });

			for (const path of ['/', '/no-existe']) {
				// Se espera a que la página esté cargada: navegar antes corta la carga de los módulos.
				await page.goto(path);
				await page.waitForLoadState('networkidle');
				const overflow = await page.evaluate(
					() => document.documentElement.scrollWidth - document.documentElement.clientWidth
				);
				expect(overflow, `desplazamiento horizontal en ${path}`).toBeLessThanOrEqual(0);
			}
		});
	}
});
