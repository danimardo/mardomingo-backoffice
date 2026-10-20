// Administración de contenido de extremo a extremo (T314, T315; W48, W49). Un solo spec con una sola cuenta administradora: el
// índice `one_admin` impide dos administradores en la misma base, y cada spec no puede promover el suyo. La cuenta se promueve en la
// base del servidor E2E (ruta en `test-results/e2e/db-path.txt`, escrita por `playwright.config.ts`).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
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

let email = '';

test.beforeAll(async ({ baseURL }) => {
	const base = baseURL ?? 'http://localhost:7390';
	email = uniqueGmail('admin-contenido');
	const request = await playwrightRequest.newContext({ baseURL: base });
	try {
		await registerThroughForm(request, base, email);
		await verifyThroughForm(request, base, verificationTokenFor(email));
	} finally {
		await request.dispose();
	}
	const db = new Database(readFileSync(join('test-results', 'e2e', 'db-path.txt'), 'utf8'));
	try {
		// Un reintento crea otra cuenta: se quita el rol antes para no violar el índice de un solo administrador.
		db.prepare("UPDATE user SET role = 'user' WHERE role = 'admin'").run();
		db.prepare("UPDATE user SET role = 'admin' WHERE email = ?").run(email);
	} finally {
		db.close();
	}
});

async function loginAsAdmin(page: Page): Promise<void> {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Entrar' }).click();
	await page.waitForLoadState('networkidle');
	await expect(page).toHaveURL(/\/panel$/);
}

// --- Documentos legales (W48) ---

async function publish(
	page: Page,
	options: { document: string; version: string; reacceptance: boolean }
): Promise<void> {
	await page.goto('/admin/legal');
	await page.waitForLoadState('networkidle');
	await page.locator('input#documento').fill(options.document);
	await page.getByLabel(/^Versión \(fecha de publicación\)/).fill(options.version);
	await page.getByLabel(/^Contenido en Markdown/).fill(`# Versión ${options.version}`);
	if (options.reacceptance) {
		await page.getByLabel(/^Exige que cada persona lo acepte de nuevo/).check();
	}
	await page.getByLabel(/^Confirmo que quiero publicar esta versión/).check();
	await page.getByRole('button', { name: 'Publicar', exact: true }).click();
	await page.waitForLoadState('networkidle');
}

// Solo documentos que el registro no acepta (términos, privacidad y uso aceptable): otros specs se registran con la versión inicial.
test('@BE-FR-70 un administrador publica una versión informativa y aparece como vigente', async ({
	page
}) => {
	await loginAsAdmin(page);
	await publish(page, { document: 'cookies', version: '2026-12-01', reacceptance: false });

	await expect(page).toHaveURL(/\/admin\/legal$/);
	await expect(page.getByText('cookies · 2026-12-01')).toBeVisible();
});

test('@BE-FR-70 una versión que exige reaceptación se marca como tal en W48', async ({ page }) => {
	await loginAsAdmin(page);
	await publish(page, { document: 'withdrawal_waiver', version: '2026-12-15', reacceptance: true });

	await expect(page.getByText(/withdrawal_waiver · 2026-12-15 · .*reaceptación/)).toBeVisible();
});

// --- Anuncios (W49) ---

async function fillAnnouncement(page: Page, message: string): Promise<void> {
	await page.goto('/admin/anuncios');
	await page.waitForLoadState('networkidle');
	const nuevo = page.getByRole('region', { name: 'Nuevo anuncio' });
	await nuevo.getByLabel(/^Mensaje/).fill(message);
	await nuevo.getByLabel(/^Nivel/).selectOption('info');
	await nuevo.getByLabel(/^Inicio/).fill('2026-10-01T08:00');
}

test('@BE-FR-85 previsualizar muestra el anuncio sin guardarlo', async ({ page }) => {
	await loginAsAdmin(page);
	const message = 'Previsualización E2E sin guardar';
	await fillAnnouncement(page, message);
	await page
		.getByRole('region', { name: 'Nuevo anuncio' })
		.getByRole('button', { name: 'Previsualizar' })
		.click();
	await page.waitForLoadState('networkidle');

	await expect(page.getByRole('heading', { name: 'Vista previa' })).toBeVisible();
	await expect(page.getByText(message)).toBeVisible();
	await expect(page.getByText('Así se verá. Todavía no se ha guardado nada.')).toBeVisible();
	await page.goto('/admin/anuncios');
	await expect(page.getByText(message)).toHaveCount(0);
});

test('@BE-FR-85 un anuncio creado aparece en la lista con su identificador', async ({ page }) => {
	await loginAsAdmin(page);
	const message = 'Anuncio E2E creado';
	await fillAnnouncement(page, message);
	await page
		.getByRole('region', { name: 'Nuevo anuncio' })
		.getByRole('button', { name: 'Crear anuncio' })
		.click();
	await page.waitForLoadState('networkidle');

	await expect(page.getByText(message)).toBeVisible();
	await expect(page.locator('code').filter({ hasText: /^ann_/ }).first()).toBeVisible();
});

test('@BE-FR-76 la facturación filtra un periodo y descarga el CSV de ventas con su nombre', async ({
	page
}) => {
	await loginAsAdmin(page);
	await page.goto('/admin/facturacion?desde=2026-10-01&hasta=2026-10-31');
	await page.waitForLoadState('networkidle');

	await expect(page.getByText('Ventas en el periodo: 0')).toBeVisible();
	const href = await page
		.getByRole('link', { name: 'Descargar ventas (CSV)' })
		.getAttribute('href');
	expect(href).toContain('/admin/facturacion/exportar?archivo=ventas');

	const response = await page.request.get(href ?? '');
	expect(response.status()).toBe(200);
	expect(response.headers()['content-type']).toContain('text/csv');
	expect(response.headers()['content-disposition']).toContain('attachment');
});

test('@BE-FR-54 las estadísticas muestran «sin datos» donde no hay datos, nunca cero', async ({
	page
}) => {
	await loginAsAdmin(page);
	await page.goto('/admin/estadisticas?desde=2026-10-01&hasta=2026-10-31');
	await page.waitForLoadState('networkidle');

	await expect(page.getByRole('heading', { name: 'Estadísticas', level: 1 })).toBeVisible();
	await expect(page.getByText('descargas: sin datos')).toBeVisible();
	await expect(page.getByText(/^altas: /)).toBeVisible();
});

test('@BE-FR-50 la lista encuentra la cuenta por email y su ficha muestra bolsas, facturas y datos fiscales', async ({
	page
}) => {
	await loginAsAdmin(page);
	await page.goto('/admin/usuarios');
	await page.waitForLoadState('networkidle');
	await page.locator('#busqueda').fill(email);
	await page.getByRole('button', { name: 'Buscar' }).click();
	await page.waitForLoadState('networkidle');

	await page.getByRole('link', { name: email }).click();
	await page.waitForLoadState('networkidle');

	await expect(page.getByRole('heading', { name: 'Bolsas de crédito' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Facturas' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Datos fiscales' })).toBeVisible();
	await expect(page.getByText('No tiene datos fiscales registrados.')).toBeVisible();
});

test('@BE-FR-50 previsualizar un bloqueo muestra el paso de confirmación y no bloquea nada', async ({
	page
}) => {
	await loginAsAdmin(page);
	await page.goto('/admin/usuarios');
	await page.waitForLoadState('networkidle');
	await page.locator('#busqueda').fill(email);
	await page.getByRole('button', { name: 'Buscar' }).click();
	await page.waitForLoadState('networkidle');
	await page.getByRole('link', { name: email }).click();
	await page.waitForLoadState('networkidle');

	const bloqueo = page.locator('section[aria-labelledby="bloquear"]');
	await bloqueo.locator('input[name="motivo"]').fill('Prueba de vista previa');
	await bloqueo.getByRole('button', { name: 'Previsualizar' }).click();
	await page.waitForLoadState('networkidle');

	await expect(page.getByRole('heading', { name: 'Vista previa' })).toBeVisible();
	await expect(
		page.getByText('Todavía no se ha cambiado nada. Confirma para aplicarlo.')
	).toBeVisible();
	await expect(page.locator('section[aria-labelledby="bloquear"]')).toBeVisible();
});

test('@BE-FR-50 un administrador bloquea y desbloquea una cuenta, cada acción con su confirmación', async ({
	page,
	baseURL
}) => {
	const base = baseURL ?? 'http://localhost:7390';
	const objetivo = uniqueGmail('objetivo-bloqueo');
	const request = await playwrightRequest.newContext({ baseURL: base });
	try {
		await registerThroughForm(request, base, objetivo);
		await verifyThroughForm(request, base, verificationTokenFor(objetivo));
	} finally {
		await request.dispose();
	}

	await loginAsAdmin(page);
	await page.goto('/admin/usuarios');
	await page.waitForLoadState('networkidle');
	await page.locator('#busqueda').fill(objetivo);
	await page.getByRole('button', { name: 'Buscar' }).click();
	await page.waitForLoadState('networkidle');
	await page.getByRole('link', { name: objetivo }).click();
	await page.waitForLoadState('networkidle');

	const bloquear = page.locator('section[aria-labelledby="bloquear"]');
	await bloquear.locator('input[name="motivo"]').fill('Bloqueo de prueba E2E');
	await bloquear.getByRole('checkbox', { name: 'Confirmo esta acción' }).check();
	await bloquear.getByRole('button', { name: 'Bloquear', exact: true }).click();
	await page.waitForLoadState('networkidle');

	const desbloquear = page.locator('section[aria-labelledby="desbloquear"]');
	await expect(desbloquear).toBeVisible();
	await desbloquear.locator('input[name="motivo"]').fill('Desbloqueo de prueba E2E');
	await desbloquear.getByRole('checkbox', { name: 'Confirmo esta acción' }).check();
	await desbloquear.getByRole('button', { name: 'Desbloquear', exact: true }).click();
	await page.waitForLoadState('networkidle');

	await expect(page.locator('section[aria-labelledby="bloquear"]')).toBeVisible();
});

// --- Ajuste de saldo (W36; T307, BE-FR-18, 15.12) ---

function dbFile(): Database.Database {
	return new Database(readFileSync(join('test-results', 'e2e', 'db-path.txt'), 'utf8'));
}

function userIdOf(address: string): string {
	const db = dbFile();
	try {
		const row = db
			.prepare<[string], { id: string }>('SELECT id FROM user WHERE email = ?')
			.get(address);
		if (row === undefined) throw new Error(`no existe la cuenta ${address}`);
		return row.id;
	} finally {
		db.close();
	}
}

function adjustmentsOf(userId: string): number {
	const db = dbFile();
	try {
		return (
			db
				.prepare<[string], { n: number }>(
					"SELECT COUNT(*) AS n FROM credit_movements WHERE user_id = ? AND type = 'adjustment'"
				)
				.get(userId)?.n ?? 0
		);
	} finally {
		db.close();
	}
}

async function createTarget(baseURL: string | undefined, prefix: string): Promise<string> {
	const base = baseURL ?? 'http://localhost:7390';
	const address = uniqueGmail(prefix);
	const request = await playwrightRequest.newContext({ baseURL: base });
	try {
		await registerThroughForm(request, base, address);
		await verifyThroughForm(request, base, verificationTokenFor(address));
	} finally {
		await request.dispose();
	}
	return address;
}

async function fillAdjustment(page: Page, motivo: string): Promise<void> {
	await page.locator('input#cantidad').fill('2');
	await page.locator('select#tipo').selectOption('credit');
	await page.locator('select#bolsa').selectOption('free');
	await page.locator('input#vence').fill('2030-01-01');
	await page.locator('input#motivo').fill(motivo);
}

test('@BE-FR-18 la vista previa del ajuste no cambia el saldo; aplicarlo sí, y deja su aviso', async ({
	page,
	baseURL
}) => {
	const address = await createTarget(baseURL, 'ajuste-vista');
	const userId = userIdOf(address);
	await loginAsAdmin(page);
	await page.goto(`/admin/usuarios/${userId}/ajuste`);
	await page.waitForLoadState('networkidle');
	await fillAdjustment(page, 'Compensación de prueba E2E');
	const antes = adjustmentsOf(userId);

	await page.getByRole('button', { name: 'Ver vista previa' }).click();
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('heading', { name: 'Ver vista previa' })).toBeVisible();
	await expect(page.getByText('Saldo después')).toBeVisible();
	expect(adjustmentsOf(userId)).toBe(antes);

	await page.getByLabel('Confirmo que quiero aplicar este ajuste').check();
	await page.getByRole('button', { name: 'Aplicar ajuste' }).click();
	await page.waitForLoadState('networkidle');

	await expect(page).toHaveURL(/aviso=ajuste_aplicado/);
	expect(adjustmentsOf(userId)).toBe(antes + 1);
});

test('@BE-FR-18 un reenvío del mismo formulario no aplica el ajuste dos veces (15.12)', async ({
	page,
	baseURL
}) => {
	const address = await createTarget(baseURL, 'ajuste-doble');
	const userId = userIdOf(address);
	await loginAsAdmin(page);
	await page.goto(`/admin/usuarios/${userId}/ajuste`);
	await page.waitForLoadState('networkidle');
	await fillAdjustment(page, 'Doble envío E2E');
	const clave = await page.locator('input[name="clave"]').inputValue();
	const antes = adjustmentsOf(userId);

	await page.getByLabel('Confirmo que quiero aplicar este ajuste').check();
	await page.getByRole('button', { name: 'Aplicar ajuste' }).click();
	await page.waitForLoadState('networkidle');
	expect(adjustmentsOf(userId)).toBe(antes + 1);

	// Un reenvío con la misma clave (recarga, red lenta o doble clic que llega tarde).
	const reenvio = await page.request.post(`/admin/usuarios/${userId}/ajuste?/ajustarSaldo`, {
		form: {
			cantidad: '2',
			tipo: 'credit',
			bolsa: 'free',
			vence: '2030-01-01',
			motivo: 'Doble envío E2E',
			confirmado: 'true',
			clave
		},
		headers: { origin: baseURL ?? 'http://localhost:7390' }
	});

	expect(reenvio.status()).toBeLessThan(500);
	expect(adjustmentsOf(userId)).toBe(antes + 1);
});

// El 400 es la respuesta esperada al aplicar sin confirmar: el navegador lo registra y el fixture lo admite solo aquí.
test.use({ guardAllow: [/status of 400 \(Bad Request\)/] });

test('@BE-FR-18 aplicar sin la casilla de confirmación no cambia nada y lo dice', async ({
	page,
	baseURL
}) => {
	const address = await createTarget(baseURL, 'ajuste-sinconfirmar');
	const userId = userIdOf(address);
	await loginAsAdmin(page);
	await page.goto(`/admin/usuarios/${userId}/ajuste`);
	await page.waitForLoadState('networkidle');
	await fillAdjustment(page, 'Sin confirmar E2E');
	const antes = adjustmentsOf(userId);

	await page.getByRole('button', { name: 'Aplicar ajuste' }).click();
	await page.waitForLoadState('networkidle');

	await expect(page.getByText('No se ha aplicado nada. Revisa los campos.')).toBeVisible();
	expect(adjustmentsOf(userId)).toBe(antes);
});

// --- Marcar tester (T306, BE-FR-50): el paso de confirmación de la ficha ---

function roleOf(userId: string): string {
	const db = dbFile();
	try {
		return (
			db.prepare<[string], { role: string }>('SELECT role FROM user WHERE id = ?').get(userId)
				?.role ?? ''
		);
	} finally {
		db.close();
	}
}

// El primer envío sin confirmar responde 400 a propósito: el fixture lo admite solo en este test.
test.use({ guardAllow: [/status of 400 \(Bad Request\)/] });

test('@BE-FR-50 marcar tester exige confirmación y motivo, y solo entonces cambia el rol', async ({
	page,
	baseURL
}) => {
	const address = await createTarget(baseURL, 'tester-objetivo');
	const userId = userIdOf(address);
	await loginAsAdmin(page);
	await page.goto(`/admin/usuarios/${userId}`);
	await page.waitForLoadState('networkidle');

	const testerSeccion = page.locator('section[aria-labelledby="tester"]');
	await testerSeccion.locator('input[name="motivo"]').fill('Prueba de tester E2E');
	await testerSeccion.getByRole('button', { name: 'Marcar tester' }).click();
	await page.waitForLoadState('networkidle');
	expect(roleOf(userId).split(',')).not.toContain('tester');

	await page.goto(`/admin/usuarios/${userId}`);
	await page.waitForLoadState('networkidle');
	const conConfirmacion = page.locator('section[aria-labelledby="tester"]');
	await conConfirmacion.locator('input[name="motivo"]').fill('Prueba de tester E2E');
	await conConfirmacion.getByRole('checkbox', { name: 'Confirmo esta acción' }).check();
	await conConfirmacion.getByRole('button', { name: 'Marcar tester' }).click();
	await page.waitForLoadState('networkidle');
	expect(roleOf(userId).split(',')).toContain('tester');
});
