// Estados de sesión del proyecto `setup` (T112; BE-FR-02, BE-FR-06, BE-FR-64): cada estado abre el panel como debe. La cuenta
// `user` entra; la `blocked` y la anónima llegan al login. Sin navegador de por medio, los estados se crean en `setup`.
import { expect, test } from './fixtures';

test.describe('cuenta con sesión', () => {
	test.use({ storageState: 'e2e/.auth/user.json' });

	test('@BE-FR-02 el usuario verificado abre el panel sin pasar por el login', async ({ page }) => {
		await page.goto('/panel');

		await expect(page).toHaveURL(/\/panel(\/|$|\?)/);
		await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
	});
});

test.describe('cuenta bloqueada', () => {
	test.use({ storageState: 'e2e/.auth/blocked.json' });

	test('@BE-FR-02 una cuenta bloqueada no abre el panel y va al login', async ({ page }) => {
		await page.goto('/panel');

		await expect(page).toHaveURL(/\/login/);
	});
});

test.describe('anónimo', () => {
	test.use({ storageState: 'e2e/.auth/anonymous.json' });

	test('@BE-FR-02 sin sesión, el panel manda al login con el destino guardado', async ({
		page
	}) => {
		await page.goto('/panel');

		await expect(page).toHaveURL(/\/login\?redirectTo=%2Fpanel/);
	});
});
