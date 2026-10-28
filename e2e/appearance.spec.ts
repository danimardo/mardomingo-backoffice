// Apariencia y accesibilidad de la interfaz (T054; UX-TEMA CA1–CA5; UX-EFECTOS CA1–CA4; V08; SC-017).
// Con JavaScript desactivado el tema se decide solo en el servidor. Con JavaScript, el cambio del sistema se
// aplica sin recargar. Las comprobaciones que el navegador no puede dar se anotan como «no verificable».
import type { Browser } from '@playwright/test';
import { expect, test } from './fixtures';
import { emulate, emulateReducedTransparency, recordUx } from './fixtures/ux-emulation';

// Sin JavaScript, Chromium intenta precargar los módulos de la aplicación y la CSP los bloquea. Esos módulos no
// se necesitan sin JS: el aviso se acepta solo en estas pruebas, no en las que usan JavaScript.
const PRELOAD_CSP = /requestfailed: .*\(csp\)/;

const WIDTHS = [320, 390, 1366];

// Captura de la página con JavaScript desactivado y con el mismo sistema claro: la pintura que ve el usuario antes de
// que la aplicación se ejecute. Se compara con la de la página ya hidratada, en la misma resolución.
async function capturaConJavaScript(
	browser: Browser,
	origen: string,
	tamano: { width: number; height: number } | null
): Promise<Buffer> {
	const referencia = await browser.newContext({ colorScheme: 'light', viewport: tamano });
	try {
		const pagina = await referencia.newPage();
		await pagina.goto(`${origen}/`);
		await pagina.waitForLoadState('networkidle');
		return await pagina.screenshot({ type: 'png' });
	} finally {
		await referencia.close();
	}
}

// Color RGB de cuatro esquinas de una captura, leído en una página de sonda (sin CSP ni JavaScript de la app).
// Devuelve doce números: r, g, b por esquina.
async function coloresDeCaptura(browser: Browser, captura: Buffer): Promise<number[]> {
	const sonda = await browser.newContext();
	try {
		const pagina = await sonda.newPage();
		await pagina.setContent('<!doctype html><title>sonda</title>');
		return await pagina.evaluate(async (datos) => {
			const imagen = await createImageBitmap(
				new Blob([new Uint8Array(datos)], { type: 'image/png' })
			);
			const lienzo = document.createElement('canvas');
			lienzo.width = imagen.width;
			lienzo.height = imagen.height;
			const contexto = lienzo.getContext('2d');
			if (!contexto) throw new Error('sin contexto 2d');
			contexto.drawImage(imagen, 0, 0);
			const esquinas: [number, number][] = [
				[1, 1],
				[imagen.width - 2, 1],
				[1, imagen.height - 2],
				[imagen.width - 2, imagen.height - 2]
			];
			return esquinas.flatMap(([x, y]) =>
				Array.from(contexto.getImageData(x, y, 1, 1).data).slice(0, 3)
			);
		}, Array.from(captura));
	} finally {
		await sonda.close();
	}
}

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

	// La medida es la captura de la página sin JavaScript, tomada tras la carga (sin hidratación que la cambie). No es el
	// primer fotograma real: ese no se puede capturar de forma fiable desde Playwright (ver la nota junto a la prueba con JS).
	test('[UX-TEMA/CA1] sin JavaScript y con sistema claro, la pintura ya es clara y coincide con la final', async ({
		page,
		browser,
		browserName
	}) => {
		// La sonda de píxeles se cuelga en Firefox headless (RenderCompositorSWGL, reproducido en local el 2026-10-28, 30 s de
		// espera). Solo Chromium hasta resolverlo; las demás pruebas de tema sin JavaScript siguen en todos los navegadores.
		test.skip(
			browserName !== 'chromium',
			'sonda de píxeles solo fiable en Chromium (ver el comentario)'
		);
		await page.goto('/');
		const pintura = await page.screenshot({ type: 'png' });
		const origen = new URL(page.url()).origin;
		const conJavaScript = await capturaConJavaScript(browser, origen, page.viewportSize());

		const sinJavaScript = await coloresDeCaptura(browser, pintura);
		const final = await coloresDeCaptura(browser, conJavaScript);

		expect(sinJavaScript).toHaveLength(final.length);
		const diferencia = Math.max(
			...sinJavaScript.map((valor, i) => Math.abs(valor - (final[i] ?? 0)))
		);
		expect(
			diferencia,
			'las esquinas sin JavaScript difieren de la página final'
		).toBeLessThanOrEqual(4);
		const media = final.reduce((suma, valor) => suma + valor, 0) / final.length;
		expect(media, 'el tema de la página final no es claro').toBeGreaterThan(128);
	});

	test('[UX-TEMA/CA4] sin JavaScript, la opción actual va marcada según la cookie', async ({
		page,
		context
	}) => {
		await context.addCookies([{ name: 'mdm_theme', value: 'dark', url: 'http://localhost:7390' }]);
		await page.goto('/login');

		const grupo = page.getByRole('group', { name: 'Tema' });
		await expect(grupo.getByRole('button', { name: 'Oscuro' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(grupo.getByRole('button', { name: 'Claro' })).toHaveAttribute(
			'aria-pressed',
			'false'
		);
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
		await expect(page.getByLabel('Email')).toBeFocused();
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

// Completa UX-TEMA de T359: la cookie del tema dura un año (CA3), el perfil conserva lo escrito al cambiar el sistema (CA2) y
// el selector aparece en las páginas públicas sin sesión y sin JavaScript (CA4).
test.describe('tema: caducidad, perfil y páginas públicas (T359)', () => {
	test('[UX-TEMA/CA3] «Oscuro» deja la cookie del tema con caducidad de unos 365 días', async ({
		page,
		browserName
	}, testInfo) => {
		test.skip(browserName === 'webkit', 'WebKit no guarda cookies Secure sobre http (ver arriba)');
		await page.goto('/preferencias');
		await page.locator('#contenido').getByRole('button', { name: 'Oscuro' }).click();
		await page.waitForLoadState('networkidle');

		const cookie = (await page.context().cookies()).find((c) => c.name === 'mdm_theme');
		expect(cookie?.value).toBe('dark');
		const days = ((cookie?.expires ?? 0) * 1000 - Date.now()) / 86_400_000;
		expect(days, `caducidad de ${days.toFixed(1)} días`).toBeGreaterThan(360);
		expect(days).toBeLessThan(370);
		recordUx(testInfo, 'cookie del tema con un año', 'comprobado');
	});

	test.describe('perfil con sesión', () => {
		test.use({ storageState: 'e2e/.auth/user.json' });

		test('[UX-TEMA/CA2] con «Sistema», cambiar el sistema en /panel/perfil conserva lo escrito y la posición', async ({
			page
		}) => {
			await emulate(page, { colorScheme: 'light' });
			await page.goto('/panel/perfil');
			const city = page.getByLabel('Ciudad');
			await city.fill('texto que no se pierde');
			await page.evaluate(() => {
				window.__sinRecarga = true;
				window.scrollTo(0, 120);
			});
			const scrollBefore = await page.evaluate(() => window.scrollY);
			const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

			await emulate(page, { colorScheme: 'dark' });

			const after = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
			expect(after).not.toBe(before);
			await expect(city).toHaveValue('texto que no se pierde');
			await expect(city).toBeFocused();
			expect(await page.evaluate(() => window.__sinRecarga === true)).toBe(true);
			// Firefox restaura el desplazamiento con redondeo subpíxel (1 px de diferencia observada el 2026-10-26): tolerancia de 2 px.
			const scrollAfter = await page.evaluate(() => window.scrollY);
			expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThanOrEqual(2);
		});
	});

	test.describe('páginas públicas sin JavaScript', () => {
		test.use({ javaScriptEnabled: false, guardAllow: [PRELOAD_CSP] });

		for (const route of ['/', '/login', '/registro', '/precios']) {
			test(`[UX-TEMA/CA4] ${route} muestra las tres opciones de tema sin JavaScript`, async ({
				page
			}) => {
				await page.goto(route);
				for (const name of ['Sistema', 'Claro', 'Oscuro']) {
					await expect(
						page.getByRole('group', { name: 'Tema' }).getByRole('button', { name })
					).toBeVisible();
					if (name === 'Sistema') {
						await expect(
							page.getByRole('group', { name: 'Tema' }).getByRole('button', { name })
						).toHaveAttribute('aria-pressed', 'true');
					}
				}
			});
		}
	});
});

// Tema desde la primera pintura con JavaScript (T359, UX-TEMA/CA1). Aproximación medible: el fondo calculado en DOMContentLoaded,
// antes de que la hidratación cambie nada, debe coincidir con el fondo final. No es el primer fotograma: Playwright no lo captura
// de forma fiable, así que el destello real sigue sin verificar y se queda como pendiente de revisión manual.
const ESQUEMAS: ('light' | 'dark')[] = ['light', 'dark'];
for (const scheme of ESQUEMAS) {
	test.describe(`primera pintura con sistema ${scheme} (T359)`, () => {
		test.use({ colorScheme: scheme });

		test(`[UX-TEMA/CA1] sin cookie, el fondo antes de hidratar ya es el del sistema (${scheme})`, async ({
			page
		}) => {
			await page.addInitScript(() => {
				document.addEventListener(
					'DOMContentLoaded',
					() => {
						sessionStorage.setItem(
							'fondoAntesDeHidratar',
							getComputedStyle(document.body).backgroundColor
						);
					},
					{ once: true }
				);
			});

			await page.goto('/');
			await page.waitForLoadState('networkidle');

			const antes = await page.evaluate(() => sessionStorage.getItem('fondoAntesDeHidratar'));
			const despues = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
			expect(antes).toBe(despues);
		});
	});
}

// Pendiente, revisión manual (T359, UX-TEMA/CA5): el tema oscuro en estados, foco, gráficas e imágenes. No se automatiza.
// Pendiente, no verificado en E2E: la persistencia «al día siguiente» de la cookie del tema (solo se prueba su caducidad).

// Cristal opaco en todas las superficies con efectos reducidos (T357, UX-EFECTOS/CA2): ninguna superficie `data-surface="glass"`
// desenfoca el fondo ni es translúcida. Amplía la prueba de la cabecera a todas las que la página pinte.
test.describe('cristal opaco en todas las superficies con efectos reducidos (T357)', () => {
	test.use({ guardAllow: [PRELOAD_CSP] });

	for (const route of ['/', '/login', '/precios']) {
		test(`[UX-EFECTOS/CA2] ${route}: las superficies de cristal son opacas con efectos reducidos`, async ({
			page
		}) => {
			await page
				.context()
				.addCookies([{ name: 'mdm_effects', value: 'reduced', url: 'http://localhost:7390' }]);
			await page.goto(route);
			await page.waitForLoadState('networkidle');

			const surfaces = await page.locator('[data-surface="glass"]').evaluateAll((els) =>
				els.map((el) => {
					const style = getComputedStyle(el);
					return { backdrop: style.backdropFilter, background: style.backgroundColor };
				})
			);
			expect(surfaces.length, 'la página pinta al menos una superficie de cristal').toBeGreaterThan(
				0
			);
			for (const surface of surfaces) {
				expect(surface.backdrop === 'none' || /blur\(0(px)?\)/.test(surface.backdrop)).toBe(true);
				expect(surface.background).not.toMatch(/rgba\(.*,\s*0?\.\d+\)/);
			}
		});
	}
});
