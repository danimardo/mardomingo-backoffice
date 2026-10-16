// Privacidad de la cuenta de extremo a extremo (T288; BE-FR-07, BE-FR-08; UX-07): la exportación se descarga con su nombre y sus
// cabeceras y solo contiene la cuenta; W29 se adapta a móvil y a escritorio; y borrar la cuenta pierde el saldo, cierra la
// sesión, impide entrar con el email antiguo y deja registrarse de nuevo sin recibir otra bienvenida (crítico 6, parte de
// borrado). Van en serie y comparten una cuenta creada una vez: el borrado va el último.
import { request as playwrightRequest, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import {
	PASSWORD,
	registerThroughForm,
	uniqueGmail,
	verificationTokenFor,
	verifyThroughForm
} from './outbox';

test.describe.configure({ mode: 'serial' });
// Una petición de datos de SvelteKit (`__data.json`) puede quedar abortada al cerrar la página, una vez terminada la
// prueba. No es un fallo de la página: las aserciones verifican el comportamiento. Solo se admite ese caso.
// Una descarga (`attachment`) hace que el navegador aborte la navegación: es el comportamiento esperado, no un fallo.
// Una sola expresión: con varias, la opción `guardAllow` llega corrupta a la fixture (ver `sesion.spec.ts`).
test.use({ guardAllow: [/__data\.json.*ERR_ABORTED|perfil\/exportar.*ERR_ABORTED/] });

let email = '';

test.beforeAll(async ({ baseURL }) => {
	const base = baseURL ?? 'http://localhost:7390';
	email = uniqueGmail('privacidad');
	const request = await playwrightRequest.newContext({ baseURL: base });
	try {
		await registerThroughForm(request, base, email);
		await verifyThroughForm(request, base, verificationTokenFor(email));
	} finally {
		await request.dispose();
	}
});

async function login(page: Page): Promise<void> {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Entrar' }).click();
	await page.waitForLoadState('networkidle');
	await expect(page).toHaveURL(/\/panel$/);
}

test('@BE-FR-08 la exportación se descarga con su nombre y solo contiene la cuenta', async ({
	page
}) => {
	await login(page);
	await page.goto('/panel/perfil');
	await page.waitForLoadState('networkidle');

	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('link', { name: 'Descargar mis datos (JSON)' }).click()
	]);
	expect(download.suggestedFilename()).toMatch(/^cuenta-mardomingo-datos-\d{4}-\d{2}-\d{2}\.json$/);

	const response = await page.request.get('/panel/perfil/exportar');
	expect(response.status()).toBe(200);
	const headers = response.headers();
	expect(headers['content-type']).toContain('application/json');
	expect(headers['content-disposition']).toMatch(
		/^attachment; filename="cuenta-mardomingo-datos-\d{4}-\d{2}-\d{2}\.json"$/
	);
	expect(headers['cache-control']).toBe('private, no-store');

	const text = await response.text();
	const data: unknown = JSON.parse(text);
	expect(data).toMatchObject({
		schemaVersion: 1,
		profile: { email, emailVerified: true },
		movements: [{ type: 'welcome' }]
	});
	// Los tres documentos del alta y nada más de otras cuentas ni del sistema.
	expect(text).toContain('"document": "terms"');
	expect(text).not.toMatch(/"(password|token|hash)"/i);
	const emails = new Set(text.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi));
	expect([...emails]).toEqual([email]);
});

test('@UX-07 sin sesión, la exportación y el borrado mandan al login', async ({ page }) => {
	for (const path of ['/panel/perfil/exportar', '/panel/perfil/borrar']) {
		const response = await page.request.get(path, { maxRedirects: 0 });
		expect(response.status(), path).toBe(303);
		expect(response.headers().location, path).toContain('/login');
	}
});

for (const size of [
	{ width: 390, height: 844 },
	{ width: 1366, height: 768 }
]) {
	test(`@UX-07 W29 se adapta a ${String(size.width)}×${String(size.height)}: sin desplazamiento y con el botón a la vista`, async ({
		page
	}) => {
		await page.setViewportSize(size);
		await login(page);
		await page.goto('/panel/perfil/borrar');
		await page.waitForLoadState('networkidle');

		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow, 'desplazamiento horizontal').toBeLessThanOrEqual(0);
		const button = page.getByRole('button', { name: 'Borrar mi cuenta' });
		await button.scrollIntoViewIfNeeded();
		const box = await button.boundingBox();
		expect(box).not.toBeNull();
		expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(size.width);
		// El foco inicial no está en la acción destructiva.
		await expect(button).not.toBeFocused();
	});
}

test('@critical @BE-FR-07 @UX-07 borrar la cuenta pierde el saldo, cierra la sesión y libera el email sin otra bienvenida', async ({
	page,
	baseURL
}) => {
	await login(page);
	await page.goto('/panel/perfil');
	await page.waitForLoadState('networkidle');
	await page.getByRole('link', { name: 'Ir a borrar mi cuenta' }).click();
	await expect(page).toHaveURL(/\/panel\/perfil\/borrar$/);
	await page.waitForLoadState('networkidle');

	// Lo que se pierde, dicho con claridad: el saldo de bienvenida, sin reembolso y en todas las apps.
	await expect(page.getByText(/Perderás [\d.,]+ créditos/)).toBeVisible();
	await expect(page.getByText(/Perderás [\d.,]+ créditos.*sin reembolso/)).toBeVisible();
	await expect(page.getByText(/se borrará tu cuenta en todas las aplicaciones/i)).toBeVisible();

	// Contraseña errónea: no se borra nada.
	await page.getByLabel('Tu contraseña, para confirmar').fill('otra-contraseña-distinta');
	await page.getByLabel(/Entiendo que pierdo mi saldo/).check();
	await page.getByRole('button', { name: 'Borrar mi cuenta' }).click();
	await page.mouse.move(0, 0);
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('alert')).toContainText('La contraseña no es correcta.');
	await expect(page).toHaveURL(/\/panel\/perfil\/borrar$/);

	// Casilla sin marcar: tampoco, y el error enlaza con la casilla.
	await page.getByLabel('Tu contraseña, para confirmar').fill(PASSWORD);
	await page.getByLabel(/Entiendo que pierdo mi saldo/).uncheck();
	await page.getByRole('button', { name: 'Borrar mi cuenta' }).click();
	await page.mouse.move(0, 0);
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('alert').getByRole('link')).toHaveAttribute('href', '#confirmLoss');
	await expect(page).toHaveURL(/\/panel\/perfil\/borrar$/);
	expect((await page.request.get('/panel', { maxRedirects: 0 })).status()).toBe(200);

	// Con la contraseña y la casilla, se borra.
	await page.getByLabel('Tu contraseña, para confirmar').fill(PASSWORD);
	await page.getByLabel(/Entiendo que pierdo mi saldo/).check();
	await page.getByRole('button', { name: 'Borrar mi cuenta' }).click();
	await page.mouse.move(0, 0);
	await page.waitForLoadState('networkidle');
	await expect(page).toHaveURL(/\/cuenta-borrada$/);
	await expect(page.getByRole('heading', { name: 'Tu cuenta se ha borrado' })).toBeVisible();

	// La sesión se cerró en todas partes.
	const panel = await page.request.get('/panel', { maxRedirects: 0 });
	expect(panel.status()).toBe(303);
	expect(panel.headers().location).toContain('/login');

	// Con el email antiguo ya no se entra.
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Entrar' }).click();
	await page.mouse.move(0, 0);
	await page.waitForLoadState('networkidle');
	await expect(page.getByText('Email o contraseña incorrectos.')).toBeVisible();

	// El email queda libre: se puede registrar de nuevo, pero no vuelve a recibir la bienvenida.
	const base = baseURL ?? 'http://localhost:7390';
	const request = await playwrightRequest.newContext({ baseURL: base });
	try {
		await registerThroughForm(request, base, email);
		await verifyThroughForm(request, base, verificationTokenFor(email));
	} finally {
		await request.dispose();
	}
	await login(page);
	await expect(page.getByText(/no tiene bolsa de bienvenida/)).toBeVisible();
	await page.waitForLoadState('networkidle');
});

// Crítico 10 (sin JavaScript): el login, la página de borrado y el enlace de la exportación funcionan solo con formularios y
// enlaces. Las precargas de módulos que el navegador bloquea sin JS no afectan a la página (ver `sesion.spec.ts`).
test.describe('sin JavaScript', () => {
	test.use({
		javaScriptEnabled: false,
		guardAllow: [
			/__data\.json.*ERR_ABORTED|requestfailed: .*\(csp\)|status of 400|Load request cancelled/
		]
	});

	test('@critical el borrado y la exportación se piden sin JavaScript', async ({ page }) => {
		await page.goto('/login');
		await page.getByLabel('Email').fill(email);
		await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
		await page.getByRole('button', { name: 'Entrar' }).click();
		await expect(page).toHaveURL(/\/panel$/);

		await page.goto('/panel/perfil');
		const exportLink = page.getByRole('link', { name: 'Descargar mis datos (JSON)' });
		// `resolve` deja una ruta relativa: lo que importa es a dónde lleva.
		const href = await exportLink.getAttribute('href');
		expect(new URL(href ?? '', page.url()).pathname).toBe('/panel/perfil/exportar');

		await page.goto('/panel/perfil/borrar');
		await page.getByLabel('Tu contraseña, para confirmar').fill('otra-contraseña-distinta');
		await page.getByLabel(/Entiendo que pierdo mi saldo/).check();
		await page.getByRole('button', { name: 'Borrar mi cuenta' }).click();
		await expect(page.getByRole('alert')).toContainText('La contraseña no es correcta.');
		// Sin JavaScript la acción es un POST: la página vuelve con la URL de la acción.
		await expect(page).toHaveURL(/\/panel\/perfil\/borrar(\?\/borrarCuenta)?$/);
	});
});
