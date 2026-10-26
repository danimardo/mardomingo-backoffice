// Páginas públicas W01–W07 en el navegador (T354; BE-FR-59, BE-FR-60, BE-FR-73, UX-16). El fixture base ya falla ante
// cualquier petición a otro dominio, `console.error` o respuesta 5xx (15.17), así que estos recorridos lo comprueban a la vez.
import { expect, test } from './fixtures';

const LEGAL = [
	{ path: '/terminos', title: 'Términos de uso' },
	{ path: '/privacidad', title: 'Política de privacidad' },
	{ path: '/cookies', title: 'Política de cookies' },
	{ path: '/uso-aceptable', title: 'Política de uso aceptable' }
] as const;

test.describe('@BE-FR-59 @UX-16 landings', () => {
	test('@smoke la landing de la marca lista Secretario, con «Crear cuenta», «Entrar» y los precios', async ({
		page
	}) => {
		await page.goto('/');

		await expect(page.getByRole('heading', { level: 1, name: 'Cuenta Mardomingo' })).toBeVisible();
		await expect(page.getByRole('heading', { level: 3, name: 'Secretario AI' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Crear cuenta' }).first()).toBeVisible();
		await expect(page.getByRole('link', { name: 'Entrar' }).first()).toBeVisible();
		await expect(page.getByRole('link', { name: 'Ver precios orientativos' })).toBeVisible();
	});

	test('@critical la landing de Secretario lleva «Crear cuenta» a /registro?app=secretario', async ({
		page
	}) => {
		await page.goto('/');
		await page.getByRole('link', { name: 'Conocer Secretario AI' }).click();

		await expect(page).toHaveURL('/apps/secretario');
		await expect(page.getByRole('heading', { level: 1, name: 'Secretario AI' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Descargar Secretario AI' })).toBeVisible();
		// Pasos de SmartScreen en texto (UX-16).
		await expect(page.getByText('Más información')).toBeVisible();
		await expect(page.getByText('Ejecutar de todas formas')).toBeVisible();

		await page.getByRole('main').getByRole('link', { name: 'Crear cuenta' }).click();

		await expect(page).toHaveURL('/registro?app=secretario');
		await expect(page.getByRole('heading', { name: 'Crear cuenta' })).toBeVisible();
		// La navegación de cliente pide los datos de la página: se espera a que acabe antes de cerrar la prueba.
		await page.waitForLoadState('networkidle');
	});
});

test.describe('@BE-FR-59 app inexistente', () => {
	// El 404 es el resultado esperado, no un fallo de la página.
	test.use({ guardAllow: [/status of 404/] });

	test('una app que no existe muestra la página de error 404', async ({ page }) => {
		const response = await page.goto('/apps/no-existe');

		expect(response?.status()).toBe(404);
		await expect(page.getByRole('heading', { name: 'No encontramos esta página' })).toBeVisible();
	});
});

test.describe('@BE-FR-73 precios', () => {
	test('la página de precios avisa de que el cobro real depende del texto, del audio y del modelo', async ({
		page
	}) => {
		await page.goto('/precios');

		await expect(
			page.getByRole('heading', { level: 1, name: 'Precios orientativos' })
		).toBeVisible();
		await expect(page.getByText(/depende de la longitud del texto o del audio/)).toBeVisible();
	});

	test('el marco enlaza a los precios y marca la página actual', async ({ page }) => {
		await page.goto('/');
		await page
			.getByRole('navigation', { name: 'Navegación principal' })
			.getByRole('link', { name: 'Precios' })
			.click();

		await expect(page).toHaveURL('/precios');
		await page.waitForLoadState('networkidle');
		await expect(
			page
				.getByRole('navigation', { name: 'Navegación principal' })
				.getByRole('link', { name: 'Precios' })
		).toHaveAttribute('aria-current', 'page');
	});
});

test.describe('@BE-FR-60 documentos legales', () => {
	for (const { path, title } of LEGAL) {
		test(`${path} muestra el documento vigente con su versión y fecha`, async ({ page }) => {
			await page.goto(path);

			await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
			await expect(page.getByText(/Versión .*, publicada el \d{4}-\d{2}-\d{2}\./)).toBeVisible();
		});
	}

	test('/cookies declara la cookie de sesión y las dos de preferencias', async ({ page }) => {
		await page.goto('/cookies');

		const table = page.getByRole('table');
		await expect(table.getByText('better-auth.session_token')).toBeVisible();
		await expect(table.getByText('mdm_theme')).toBeVisible();
		await expect(table.getByText('mdm_effects')).toBeVisible();
	});

	test('el pie enlaza a los cuatro documentos y no hay aviso de cookies', async ({ page }) => {
		await page.goto('/');
		const footer = page.getByRole('navigation', { name: 'Documentos legales' });

		for (const { path } of LEGAL) {
			await expect(footer.locator(`a[href="${path}"]`)).toBeVisible();
		}
		await expect(page.getByText(/aceptar cookies/i)).toHaveCount(0);
	});

	test('el registro enlaza a cada documento que se acepta', async ({ page }) => {
		await page.goto('/registro');

		for (const { path } of LEGAL.filter((item) => item.path !== '/cookies')) {
			await expect(page.locator(`form a[href="${path}"]`)).toBeVisible();
		}
	});
});

test.describe('todos los enlaces internos de las páginas públicas responden', () => {
	for (const start of ['/', '/precios', '/apps/secretario', ...LEGAL.map((item) => item.path)]) {
		test(`enlaces de ${start}`, async ({ page, request }) => {
			await page.goto(start);
			const hrefs = await page
				.locator('a[href^="/"]')
				.evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));

			for (const href of new Set(hrefs)) {
				const response = await request.get(href);
				expect(response.status(), `${start} → ${href}`).toBeLessThan(400);
			}
		});
	}
});

test.describe('responsive a 320, 390 y 1366 px (mobile-first)', () => {
	for (const width of [320, 390, 1366]) {
		test(`sin desplazamiento horizontal a ${String(width)} px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 800 });
			for (const path of ['/', '/precios', '/apps/secretario', '/terminos', '/cookies']) {
				await page.goto(path);
				const overflow = await page.evaluate(
					() => document.documentElement.scrollWidth - document.documentElement.clientWidth
				);
				expect(overflow, `${path} a ${String(width)} px`).toBeLessThanOrEqual(0);
			}
		});
	}
});
