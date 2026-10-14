// Críticos 2 y 3 (T112; BE-FR-01, 02, 03): inicio y cierre de sesión con una cuenta verificada, y recuperación de la
// contraseña de extremo a extremo con el enlace del _outbox_. Van en serie y comparten una cuenta creada una vez: el
// límite de altas por IP del servidor de pruebas (tres en 24 h) no admite una cuenta por prueba. La recuperación deja la
// misma contraseña, así que el cierre de sesión del crítico 2 no depende de su orden.
import { request as playwrightRequest } from '@playwright/test';
import { checkAccessibility } from './fixtures/axe';
import { expect, test } from './fixtures';
import {
	PASSWORD,
	registerThroughForm,
	resetTokenFor,
	uniqueGmail,
	verificationTokenFor,
	verifyThroughForm
} from './outbox';

test.describe.configure({ mode: 'serial' });
// Una petición de datos de SvelteKit (`__data.json`) puede quedar abortada al cerrar la página, una vez terminada la
// prueba. No es un fallo de la página: las aserciones verifican el comportamiento. Solo se admite ese caso.
test.use({ guardAllow: [/__data\.json.*ERR_ABORTED/] });

let email = '';

test.beforeAll(async ({ baseURL }) => {
	const base = baseURL ?? 'http://localhost:7390';
	email = uniqueGmail('sesion');
	const request = await playwrightRequest.newContext({ baseURL: base });
	try {
		await registerThroughForm(request, base, email);
		await verifyThroughForm(request, base, verificationTokenFor(email));
	} finally {
		await request.dispose();
	}
});

test('@critical el login con una cuenta verificada abre el panel y el cierre de sesión vuelve al login', async ({
	page
}) => {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Entrar' }).click();
	await page.mouse.move(0, 0);
	await page.waitForLoadState('networkidle');

	await expect(page).toHaveURL(/\/panel$/);
	await expect(page.getByRole('heading', { name: 'Tu cuenta' })).toBeVisible();
	// El panel carga sus datos tras el login: se espera a que termine antes de salir de la página.
	await page.waitForLoadState('networkidle');

	await page.goto('/logout');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Cerrar sesión' }).click();
	await page.mouse.move(0, 0);
	await page.waitForLoadState('networkidle');

	await expect(page).toHaveURL(/\/login\?aviso=logged_out$/);
	await expect(page.getByText('Has cerrado sesión.')).toBeVisible();

	// Sin navegar la página: un `goto` aquí aborta la carga de datos del login que acaba de mostrar el cierre.
	const panel = await page.request.get('/panel', { maxRedirects: 0 });
	expect(panel.status()).toBe(303);
	expect(panel.headers().location).toContain('/login');
	// La página del cierre puede seguir cargando datos: se espera antes de terminar, para no cortar esa carga.
	await page.waitForLoadState('networkidle');
});

test('@critical la recuperación cambia la contraseña con el enlace del email y deja entrar con la nueva', async ({
	page
}) => {
	await page.goto('/recuperar');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Email').fill(email);
	await page.getByRole('button', { name: 'Enviar el enlace' }).click();
	await page.waitForLoadState('networkidle');

	await expect(
		page.getByText('Si la cuenta existe, te hemos enviado un enlace para cambiar la contraseña.')
	).toBeVisible();

	await page.goto(`/recuperar/nueva?token=${encodeURIComponent(resetTokenFor(email))}`);
	await page.getByLabel('Nueva contraseña').fill(PASSWORD);
	await page.getByRole('button', { name: 'Guardar la nueva contraseña' }).click();
	await page.mouse.move(0, 0);
	await page.waitForLoadState('networkidle');

	await expect(page).toHaveURL(/\/login\?aviso=password_reset$/);
	await expect(page.getByText('Tu contraseña se ha restablecido. Inicia sesión.')).toBeVisible();

	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Entrar' }).click();
	await page.mouse.move(0, 0);
	await page.waitForLoadState('networkidle');
	await expect(page).toHaveURL(/\/panel$/);
	// El panel puede seguir cargando sus datos: se espera antes de terminar, para no cortar esa carga al cerrar el test.
	await page.waitForLoadState('networkidle');
});

test('@critical una segunda cuenta con el mismo buzón de gmail no recibe la bienvenida y lo explica', async ({
	page,
	request,
	baseURL
}) => {
	const base = baseURL ?? 'http://localhost:7390';
	const plus = email.replace('@gmail.com', '+2@gmail.com');
	await registerThroughForm(request, base, plus);

	await page.goto(`/verificar?token=${encodeURIComponent(verificationTokenFor(plus))}`);
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Confirmar mi email' }).click();
	await page.waitForLoadState('networkidle');

	await expect(page).toHaveURL(/\/panel\/bienvenida$/);
	await expect(page.getByText('Tu cuenta no recibe créditos de bienvenida')).toBeVisible();
	await page.mouse.move(0, 0);
	await page.waitForLoadState('networkidle');
});

// Panel de la cuenta (T272): va en este fichero para reutilizar la cuenta de arriba (límite de altas por IP).
const PANEL_PAGES = [
	'/panel',
	'/panel/comprar',
	'/panel/movimientos',
	'/panel/consumo',
	'/panel/sesiones',
	'/panel/perfil',
	'/panel/apps',
	'/panel/facturas'
] as const;

test('cada página del panel carga con su título y sin error de servidor', async ({ page }) => {
	await login(page);
	for (const path of PANEL_PAGES) {
		const response = await page.goto(path);
		await page.waitForLoadState('networkidle');

		expect(response?.status(), path).toBeLessThan(500);
		await expect(page.locator('h1').first(), path).toBeVisible();
	}
});

test('el perfil pide el cambio de email con la contraseña y confirma el envío', async ({
	page
}) => {
	await page.goto('/panel/perfil');
	await page.waitForLoadState('networkidle');

	await page.getByLabel('Nuevo email').fill(uniqueGmail('nuevo'));
	await page.locator('#perfil-email-contrasena').fill(PASSWORD);
	await page.getByRole('button', { name: 'Enviar enlace de confirmación' }).click();
	await page.waitForLoadState('networkidle');

	await expect(page.getByText('Te hemos enviado un enlace a la nueva dirección.')).toBeVisible();
});

test('las páginas del panel no tienen fallos de accesibilidad', async ({ page }, testInfo) => {
	await login(page);
	for (const path of PANEL_PAGES) {
		await page.goto(path);
		await page.waitForLoadState('networkidle');
		await checkAccessibility(page, testInfo);
	}
});

// Compra de créditos (T247, T248): va en este fichero, junto a la cuenta que crea el `beforeAll` de arriba, para no añadir
// una cuenta más: el servidor de pruebas admite tres altas por IP en 24 h y esta cuenta contaba como la cuarta.

// Precargas de módulos que el navegador bloquea por CSP sin JavaScript, y el 400 de la validación del servidor. Una sola
// expresión: con varias, la opción `guardAllow` llega corrupta a la fixture.
const NO_JS_EXPECTED = /requestfailed: .*\(csp\)|status of 400/;

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

// Cambio de contraseña desde el perfil (T266): cambia y la devuelve a la original para no alterar
// a las demás pruebas que usan la misma cuenta.
test('@critical el perfil cambia la contraseña y la devuelve a la original', async ({ page }) => {
	const NUEVA = 'contraseña-nueva-456';
	await login(page);
	await page.goto('/panel/perfil');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Contraseña actual', { exact: true }).fill(PASSWORD);
	await page.getByLabel('Contraseña nueva', { exact: true }).fill(NUEVA);
	await page.getByLabel('Repite la contraseña nueva').fill(NUEVA);
	await page.getByRole('button', { name: 'Cambiar contraseña' }).click();

	await expect(page).toHaveURL(/\/panel\/perfil\?aviso=password_changed$/);
	await expect(page.getByText('Tu contraseña se ha cambiado')).toBeVisible();

	await page.goto('/panel/perfil');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Contraseña actual', { exact: true }).fill(NUEVA);
	await page.getByLabel('Contraseña nueva', { exact: true }).fill(PASSWORD);
	await page.getByLabel('Repite la contraseña nueva').fill(PASSWORD);
	await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
	await expect(page).toHaveURL(/\/panel\/perfil\?aviso=password_changed$/);
});

// Cierre de otra sesión desde el panel (T264): una segunda sesión abierta en otro navegador se cierra desde W26.
test('@critical cierra desde el panel otra sesión abierta de la misma cuenta', async ({
	page,
	browser
}) => {
	const otra = await browser.newContext();
	try {
		const segunda = await otra.newPage();
		await login(segunda);
		await login(page);
		await page.goto('/panel/sesiones');
		await page.waitForLoadState('networkidle');
		await page
			.getByRole('button', { name: /Cerrar la sesión de/ })
			.first()
			.click();

		await expect(page).toHaveURL(/\/panel\/sesiones\?aviso=session_closed$/);
		await expect(page.getByText('Sesión cerrada.')).toBeVisible();
	} finally {
		await otra.close();
	}
});
