// Flujos públicos sin JavaScript (T360; UX-16; constitución «Mejora progresiva»). Las páginas se leen y sus formularios se envían
// sin JavaScript. El captcha del registro es la única excepción permitida: sin él, el registro se rechaza y lo dice.
import { expect, test } from './fixtures';
import { E2E_ADMIN_EMAIL, PANEL_E2E_EMAIL, PANEL_E2E_PASSWORD } from './constants';
import { PASSWORD } from './outbox';

test.use({ javaScriptEnabled: false });
test.use({ guardAllow: [/requestfailed: .*\(csp\)|status of 400|status of 401/] });

for (const route of ['/', '/precios', '/terminos', '/privacidad', '/cookies']) {
	test(`@critical @UX-16 ${route} se lee sin JavaScript`, async ({ page }) => {
		await page.goto(route);
		await expect(page.locator('h1').first()).toBeVisible();
	});
}

test('@critical el login sin JavaScript muestra su formulario y rechaza credenciales inválidas', async ({
	page
}) => {
	await page.goto('/login');
	await page.getByLabel('Email').fill('no-existe@ejemplo.es');
	await page.getByLabel('Contraseña', { exact: true }).fill('contraseña-incorrecta-123');
	await page.getByRole('button', { name: 'Entrar' }).click();

	await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
	await expect(page.locator('form').first()).toBeVisible();
});

test('@critical el registro sin JavaScript no crea la cuenta sin captcha y lo dice', async ({
	page
}) => {
	await page.goto('/registro');
	await page.getByLabel('Email').fill('nueva.persona@ejemplo.es');
	await page.getByLabel('Contraseña', { exact: true }).fill('contraseña-segura-123');
	await page.getByRole('button', { name: 'Crear cuenta' }).click();

	await expect(page.getByRole('heading', { name: 'Crear cuenta' })).toBeVisible();
});

// Sesión sin JavaScript (T360; UX-16). Login válido, datos fiscales con error, filtros por GET, selectores de tema y de efectos
// y filtro de administración. La cuenta del panel se entra por el formulario de login en cada prueba: sin JavaScript no hay otra vía.
async function signInPanelWithoutJs(page: import('@playwright/test').Page): Promise<void> {
	await page.goto('/login');
	await page.getByLabel('Email').fill(PANEL_E2E_EMAIL);
	await page.getByLabel('Contraseña', { exact: true }).fill(PANEL_E2E_PASSWORD);
	await page.getByRole('button', { name: 'Entrar' }).click();
	await page.waitForURL(/\/panel$/);
}

test.describe('panel sin JavaScript', () => {
	test('@critical @UX-16 el login válido sin JavaScript entra en el panel', async ({ page }) => {
		await signInPanelWithoutJs(page);
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	});

	test('@UX-16 los datos fiscales con un NIF no válido se rechazan sin JavaScript y conservan lo escrito', async ({
		page
	}) => {
		await signInPanelWithoutJs(page);
		await page.goto('/panel/perfil');
		await page.getByLabel('Nombre o razón social').fill('Persona Prueba');
		await page.getByLabel('NIF o CIF').fill('12345678A');
		await page.getByLabel('Dirección').fill('Calle Mayor 1');
		await page.getByLabel('Código postal').fill('28001');
		await page.getByLabel('Ciudad').fill('Madrid');
		await page.getByRole('button', { name: 'Guardar datos de facturación' }).click();

		await expect(page).toHaveURL(/\/panel\/perfil/);
		await expect(
			page.getByText('El NIF, NIE, CIF o NIF-IVA no es válido. Revísalo.')
		).toBeVisible();
		await expect(page.getByLabel('NIF o CIF')).toHaveValue('12345678A');
	});

	test('@UX-16 el filtro de movimientos por GET conserva el orden elegido sin JavaScript', async ({
		page
	}) => {
		await signInPanelWithoutJs(page);
		await page.goto('/panel/movimientos');
		await page.locator('#filtro-orden').selectOption('desc');
		await page.getByRole('button', { name: 'Aplicar filtros' }).click();

		await expect(page).toHaveURL(/orden=desc/);
	});

	test('@critical @UX-16 el selector de tema sin JavaScript aplica el tema oscuro', async ({
		page
	}) => {
		await signInPanelWithoutJs(page);
		await page.goto('/panel');
		await page
			.locator('form[action="/preferencias?/tema"] button[name="theme"][value="dark"]')
			.first()
			.click();

		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	});

	test('@UX-16 el ajuste de efectos se guarda sin JavaScript y sobrevive a recargar', async ({
		page
	}) => {
		await signInPanelWithoutJs(page);
		await page.goto('/panel');
		const form = page.locator('form[action="/preferencias?/efectos"]').first();
		const box = form.getByRole('checkbox');
		const before = await box.isChecked();
		await box.setChecked(!before);
		await form.locator('button[type="submit"]').click();

		await page.goto('/panel');
		await expect(
			page.locator('form[action="/preferencias?/efectos"]').first().getByRole('checkbox')
		).toBeChecked({
			checked: !before
		});
	});
});

test.describe('administración sin JavaScript (cuenta de administración por formulario)', () => {
	test('@critical @UX-16 el filtro de usuarios por GET muestra la búsqueda en la URL sin JavaScript', async ({
		page
	}) => {
		await page.goto('/login');
		await page.getByLabel('Email').fill(E2E_ADMIN_EMAIL);
		await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
		await page.getByRole('button', { name: 'Entrar' }).click();
		await expect(page).toHaveURL(/\/panel$/);

		await page.goto('/admin/usuarios');
		await page.locator('#busqueda').fill('usuario.e2e');
		await page.getByRole('button', { name: 'Buscar' }).click();

		await expect(page).toHaveURL(/q=usuario\.e2e/);
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	});
});
