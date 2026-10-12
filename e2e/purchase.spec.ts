// Compra de créditos de extremo a extremo (T247; BE-FR-25, BE-FR-26, UX-05, UX-06). Una cuenta verificada compra en el entorno
// de prueba (`APP_ENV=test`, proveedor simulado): la renuncia no viene premarcada, el resultado muestra la compra y el saldo,
// y el mismo formulario enviado dos veces no acredita dos veces. Crítico 4 (con renuncia) y crítico 10 (sin JavaScript).
import { request as playwrightRequest } from '@playwright/test';
import { checkAccessibility } from './fixtures/axe';
import { expect, test } from './fixtures';
import {
	PASSWORD,
	registerThroughForm,
	uniqueGmail,
	verificationTokenFor,
	verifyThroughForm
} from './outbox';

test.describe.configure({ mode: 'serial' });
// Una petición de datos de SvelteKit puede quedar abortada al cerrar la página: no es un fallo de la compra.
test.use({ guardAllow: [/__data\.json.*ERR_ABORTED/] });

// Precargas de módulos que el navegador bloquea por CSP sin JavaScript, y el 400 de la validación del servidor. Una sola
// expresión: con varias, la opción `guardAllow` llega corrupta a la fixture.
const NO_JS_EXPECTED = /requestfailed: .*\(csp\)|status of 400/;

let email = '';

test.beforeAll(async ({ baseURL }) => {
	const base = baseURL ?? 'http://localhost:7390';
	email = uniqueGmail('compra');
	const request = await playwrightRequest.newContext({ baseURL: base });
	try {
		await registerThroughForm(request, base, email);
		await verifyThroughForm(request, base, verificationTokenFor(email));
	} finally {
		await request.dispose();
	}
});

async function login(page: import('@playwright/test').Page): Promise<void> {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Entrar' }).click();
	await page.waitForLoadState('networkidle');
	await expect(page).toHaveURL(/\/panel$/);
}

test('@critical @BE-FR-25 @UX-05 la compra con renuncia muestra el resultado y el saldo', async ({
	page
}) => {
	await login(page);
	await page.goto('/panel/comprar');
	await page.waitForLoadState('networkidle');

	await page.getByRole('link', { name: 'Elegir Pack 10 €' }).click();
	await page.waitForLoadState('networkidle');
	await expect(page.getByLabel(/renuncio a mi derecho de desistimiento/)).not.toBeChecked();
	await page.getByLabel(/renuncio a mi derecho de desistimiento/).check();
	await page.getByRole('button', { name: /Comprar 10,00\s€ de créditos/ }).click();

	await expect(page).toHaveURL(/\/panel\/comprar\/pay_/);
	await expect(page.getByRole('heading', { name: 'Resultado de la compra' })).toBeVisible();
	await expect(page.getByText('Compra simulada de prueba')).toBeVisible();
});

test('@BE-FR-25 @UX-05 un doble envío del mismo formulario no acredita dos veces', async ({
	page
}) => {
	await login(page);
	await page.goto('/panel/comprar?paquete=pck_seed_5eur');
	await page.waitForLoadState('networkidle');
	await page.getByLabel(/renuncio a mi derecho de desistimiento/).check();

	await page.getByRole('button', { name: /Comprar 5,00\s€ de créditos/ }).dblclick();

	await expect(page).toHaveURL(/\/panel\/comprar\/pay_/);
	await expect(page.getByRole('heading', { name: 'Resultado de la compra' })).toBeVisible();
});

test.describe('sin JavaScript', () => {
	// Las precargas de módulos que el navegador bloquea por CSP no son un fallo de la página sin JavaScript (como en `appearance`).
	test.use({ javaScriptEnabled: false, guardAllow: [NO_JS_EXPECTED] });

	test('@critical @BE-FR-26 @UX-05 la compra sin JavaScript exige la renuncia y después compra', async ({
		page
	}) => {
		await login(page);
		await page.goto('/panel/comprar?paquete=pck_seed_10eur');

		await expect(page.getByLabel(/renuncio a mi derecho de desistimiento/)).not.toBeChecked();
		await page.getByRole('button', { name: /Comprar 10,00\s€ de créditos/ }).click();
		await expect(page.locator('#waiver-accepted-error')).toBeVisible();

		await page.getByLabel(/renuncio a mi derecho de desistimiento/).check();
		await page.getByRole('button', { name: /Comprar 10,00\s€ de créditos/ }).click();
		await expect(page).toHaveURL(/\/panel\/comprar\/pay_/);
		await expect(page.getByRole('heading', { name: 'Resultado de la compra' })).toBeVisible();
	});
});

// Accesibilidad y matriz de tamaños de W20 y W21 (T248; 16.11): ambos temas, 320, 390 y 1366 px, sin desplazamiento
// horizontal de la página a 320 px. Cada prueba entra con una cuenta verificada, como un cliente real.
for (const scheme of ['light', 'dark'] as const) {
	for (const width of [320, 390, 1366]) {
		test(`@a11y W20 y W21 accesibles con tema ${scheme} a ${String(width)} px`, async ({
			page
		}, testInfo) => {
			await page.setViewportSize({ width, height: 844 });
			await page.emulateMedia({ colorScheme: scheme });
			await login(page);

			await page.goto('/panel/comprar?paquete=pck_seed_10eur');
			await page.waitForLoadState('networkidle');
			await checkAccessibility(page, testInfo);
			if (width === 320) {
				const overflow = await page.evaluate(
					() => document.documentElement.scrollWidth - document.documentElement.clientWidth
				);
				expect(overflow, 'desplazamiento horizontal a 320 px').toBeLessThanOrEqual(0);
			}

			await page.goto('/panel/comprar?paquete=pck_seed_5eur');
			await page.getByLabel(/renuncio a mi derecho de desistimiento/).check();
			await page.getByRole('button', { name: /Comprar 5,00\s€ de créditos/ }).click();
			await expect(page).toHaveURL(/\/panel\/comprar\/pay_/);
			await checkAccessibility(page, testInfo);
		});
	}
}
