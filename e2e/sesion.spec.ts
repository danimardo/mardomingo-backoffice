// Críticos 2 y 3 (T112; BE-FR-01, 02, 03): inicio y cierre de sesión con una cuenta verificada, y recuperación de la
// contraseña de extremo a extremo con el enlace del _outbox_. Van en serie y comparten una cuenta creada una vez: el
// límite de altas por IP del servidor de pruebas (tres en 24 h) no admite una cuenta por prueba. La recuperación deja la
// misma contraseña, así que el cierre de sesión del crítico 2 no depende de su orden.
import { request as playwrightRequest } from '@playwright/test';
import { expect, test } from './fixtures';
import {
	PASSWORD,
	registerThroughForm,
	resetTokenFor,
	uniqueEmail,
	verificationTokenFor,
	verifyThroughForm
} from './outbox';

test.describe.configure({ mode: 'serial' });

let email = '';

test.beforeAll(async ({ baseURL }) => {
	const base = baseURL ?? 'http://localhost:7390';
	email = uniqueEmail('sesion');
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
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Entrar' }).click();
	await page.waitForLoadState('networkidle');

	await expect(page).toHaveURL(/\/panel$/);
	await expect(page.getByRole('heading', { name: 'Tu cuenta' })).toBeVisible();

	await page.goto('/logout');
	await page.getByRole('button', { name: 'Cerrar sesión' }).click();
	await page.waitForLoadState('networkidle');

	await expect(page).toHaveURL(/\/login\?aviso=logged_out$/);
	await expect(page.getByText('Has cerrado sesión.')).toBeVisible();

	await page.goto('/panel');
	await expect(page).toHaveURL(/\/login/);
});

test('@critical la recuperación cambia la contraseña con el enlace del email y deja entrar con la nueva', async ({
	page
}) => {
	await page.goto('/recuperar');
	await page.getByLabel('Email').fill(email);
	await page.getByRole('button', { name: 'Enviar el enlace' }).click();
	await page.waitForLoadState('networkidle');

	await expect(
		page.getByText('Si la cuenta existe, te hemos enviado un enlace para cambiar la contraseña.')
	).toBeVisible();

	await page.goto(`/recuperar/nueva?token=${encodeURIComponent(resetTokenFor(email))}`);
	await page.getByLabel('Nueva contraseña').fill(PASSWORD);
	await page.getByRole('button', { name: 'Guardar la nueva contraseña' }).click();
	await page.waitForLoadState('networkidle');

	await expect(page).toHaveURL(/\/login\?aviso=password_reset$/);
	await expect(page.getByText('Tu contraseña se ha restablecido. Inicia sesión.')).toBeVisible();

	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Entrar' }).click();
	await page.waitForLoadState('networkidle');
	await expect(page).toHaveURL(/\/panel$/);
});
