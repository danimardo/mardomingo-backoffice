// Estados del panel con datos de todos los tipos (T250; Historias 15.22): la cuenta sembrada por `tests/e2e-seed` tiene
// bolsas, reserva, deuda, operaciones en sus estados y perfil fiscal. Comprueba que el saldo, los movimientos y el consumo los
// muestran, sin desbordamiento. Solo lectura: no crea ni cambia datos, así que puede correr en paralelo.
import { expect, test } from './fixtures';
import { PANEL_E2E_EMAIL, PANEL_E2E_PASSWORD } from './constants';

test.describe.configure({ mode: 'parallel' });

test.beforeEach(async ({ page }) => {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Email').fill(PANEL_E2E_EMAIL);
	await page.getByLabel('Contraseña', { exact: true }).fill(PANEL_E2E_PASSWORD);
	await page.getByRole('button', { name: 'Entrar' }).click();
	await page.waitForLoadState('networkidle');
	await expect(page).toHaveURL(/\/panel$/);
});

test('@BE-FR-54 el saldo muestra la deuda y los documentos pendientes de la cuenta sembrada', async ({
	page
}) => {
	const balance = page.getByRole('region', { name: 'Tu saldo' });
	// El fixture consume toda la bolsa y deja 50 créditos de deuda: el saldo total es negativo y no hay bolsas con saldo.
	await expect(
		balance.locator('dt', { hasText: 'Saldo total' }).locator('xpath=following-sibling::dd[1]')
	).toHaveText('−50');
	await expect(
		balance.locator('dt', { hasText: 'Deuda pendiente' }).locator('xpath=following-sibling::dd[1]')
	).toHaveText('50');
	await expect(page.getByText('Todavía no tienes créditos.', { exact: false })).toBeVisible();

	// Sin aceptaciones previas, los tres documentos vigentes siguen pendientes.
	await expect(
		page.getByRole('region', { name: 'Hay documentos legales pendientes de aceptar.' })
	).toBeVisible();
	await expect(
		page.getByRole('group', { name: 'Marca los documentos que aceptas' }).getByRole('checkbox')
	).toHaveCount(3);
});

test('@BE-FR-54 los movimientos muestran los tipos de la cuenta sin desbordar', async ({
	page
}) => {
	await page.goto('/panel/movimientos');
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow, `desbordamiento horizontal de ${String(overflow)} px`).toBeLessThanOrEqual(0);
});

test('@BE-FR-54 el consumo muestra las operaciones en sus estados', async ({ page }) => {
	await page.goto('/panel/consumo');
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('[UX-09] movimientos y consumo ordenan por fecha desde el formulario y conservan el orden en la URL', async ({
	page
}) => {
	for (const [path, select] of [
		['/panel/movimientos', '#filtro-orden'],
		['/panel/consumo', '#consumo-orden']
	] as const) {
		await page.goto(path);
		await page.waitForLoadState('networkidle');
		await expect(page.locator(select)).toHaveValue('desc');

		await page.locator(select).selectOption('asc');
		await page.getByRole('button', { name: 'Aplicar filtros' }).click();
		await page.waitForURL(/[?&]orden=asc/);
		await page.waitForLoadState('networkidle');

		expect(new URL(page.url()).searchParams.get('orden')).toBe('asc');
		await expect(page.locator(select)).toHaveValue('asc');
	}
});
