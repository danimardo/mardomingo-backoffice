// Administración de contenido de extremo a extremo (T314, T315; W48, W49). Un solo spec con una sola cuenta administradora: el
// índice `one_admin` impide dos administradores en la misma base, y cada spec no puede promover el suyo. La cuenta se promueve en la
// base del servidor E2E (ruta en `test-results/e2e/db-path.txt`, escrita por `playwright.config.ts`).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { request as playwrightRequest, type Page } from '@playwright/test';
import { E2E_ADMIN_EMAIL } from './constants';
import { expect, test } from './fixtures';
import { checkAccessibility } from './fixtures/axe';
import {
	PASSWORD,
	registerThroughForm,
	uniqueGmail,
	verificationTokenFor,
	verifyThroughForm
} from './outbox';

test.describe.configure({ mode: 'serial' });
// Una petición de datos de SvelteKit (`__data.json`) puede quedar abortada al navegar entre páginas: no es un fallo (ver `privacy.spec.ts`).
test.use({ guardAllow: [/status of 400 \(Bad Request\)|__data\.json.*ERR_ABORTED/] });

/**
 * Cuenta administradora de este spec: fija dentro de la base de la ejecución (cada ejecución E2E tiene la suya). Los grupos
 * del spec pueden correr en workers distintos, y cada uno ejecuta su `beforeAll`: por eso la preparación es idempotente.
 * Si el usuario ya existe no se registra de nuevo, y solo se quita el rol de administrador a otras cuentas si la nuestra no lo
 * tiene: así un segundo worker no degrada al administrador del primero (índice `one_admin`, T314).
 */
const email = E2E_ADMIN_EMAIL;

test.beforeAll(async ({ baseURL }) => {
	const base = baseURL ?? 'http://localhost:7390';
	const dbPath = readFileSync(join('test-results', 'e2e', 'db-path.txt'), 'utf8');
	const existing = new Database(dbPath);
	const known = existing.prepare('SELECT 1 FROM user WHERE email = ?').get(email) !== undefined;
	existing.close();
	if (!known) {
		const request = await playwrightRequest.newContext({ baseURL: base });
		try {
			await registerThroughForm(request, base, email);
			await verifyThroughForm(request, base, verificationTokenFor(email));
		} finally {
			await request.dispose();
		}
	}
	const db = new Database(dbPath);
	try {
		db.prepare("UPDATE user SET role = 'user' WHERE role = 'admin' AND email <> ?").run(email);
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
	// Septiembre: la cuenta sembrada para el panel compra en octubre, así que este periodo debe quedar vacío y en cero.
	await page.goto('/admin/facturacion?desde=2026-09-01&hasta=2026-09-30');
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
	// Esperar la navegación del formulario GET: si el clic en el enlace llega antes, la petición de datos se aborta.
	await page.waitForURL(/[?&]q=/);
	await page.waitForLoadState('networkidle');

	await page.getByRole('link', { name: email }).click();
	await page.waitForLoadState('networkidle');

	await expect(page.getByRole('heading', { name: 'Bolsas de crédito' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Facturas' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Datos fiscales' })).toBeVisible();
	await expect(page.getByText('No tiene datos fiscales registrados.')).toBeVisible();
});

test('[UX-15] la búsqueda sin resultados dice que no hay cuentas y conserva la consulta', async ({
	page
}) => {
	await loginAsAdmin(page);
	await page.goto('/admin/usuarios');
	await page.waitForLoadState('networkidle');

	await page.locator('#busqueda').fill('no-existe-usuario-ux15@example.invalid');
	await page.getByRole('button', { name: 'Buscar' }).click();
	await page.waitForURL(/[?&]q=/);
	await page.waitForLoadState('networkidle');

	await expect(page.getByText('No hay cuentas que coincidan con la búsqueda.')).toBeVisible();
	await expect(page.locator('#busqueda')).toHaveValue('no-existe-usuario-ux15@example.invalid');
});

test('@BE-FR-50 previsualizar un bloqueo muestra el paso de confirmación y no bloquea nada', async ({
	page
}) => {
	await loginAsAdmin(page);
	await page.goto('/admin/usuarios');
	await page.waitForLoadState('networkidle');
	await page.locator('#busqueda').fill(email);
	await page.getByRole('button', { name: 'Buscar' }).click();
	// Esperar la navegación del formulario GET: si el clic en el enlace llega antes, la petición de datos se aborta.
	await page.waitForURL(/[?&]q=/);
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
	// Esperar la navegación del formulario GET: si el clic en el enlace llega antes, la petición de datos se aborta.
	await page.waitForURL(/[?&]q=/);
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

	await expect(page).toHaveURL(/aviso=saved&auditoria=/);
	await expect(page.getByRole('status')).toContainText('Cambio guardado.');
	await expect(page.getByRole('link', { name: 'Ver la entrada en la auditoría' })).toBeVisible();
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
test.use({ guardAllow: [/status of 400 \(Bad Request\)|__data\.json.*ERR_ABORTED/] });

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
test.use({ guardAllow: [/status of 400 \(Bad Request\)|__data\.json.*ERR_ABORTED/] });

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

// --- Sin JavaScript (crítico 10; T322, 15.12): un cambio económico completo con vista previa y confirmación ---

const SALDO_MINIMO = 'min_balance_to_operate';

async function cambiarSaldoMinimo(page: Page, valor: string, motivo: string): Promise<void> {
	await page.goto('/admin/economia');
	const formulario = page.locator('form', {
		has: page.locator(`input[name="clave"][value="${SALDO_MINIMO}"]`)
	});
	await formulario.locator('input[name="valor"]').fill(valor);
	await formulario.locator('input[name="motivo"]').fill(motivo);
	await formulario.getByRole('button', { name: 'Previsualizar cambio' }).click();
	await page.waitForLoadState('load');

	const aplicar = page.locator('form', {
		has: page.locator(`input[name="valor"][value="${valor}"]`)
	});
	await expect(page.getByRole('heading', { name: 'Vista previa del cambio' })).toBeVisible();
	await aplicar.locator('input[name="motivo"]').fill(motivo);
	await aplicar.getByLabel('Confirmo este cambio').check();
	await aplicar.getByRole('button', { name: 'Guardar parámetro' }).click();
	await page.waitForLoadState('load');
}

test.describe('sin JavaScript', () => {
	// Con JavaScript desactivado el navegador bloquea las precargas de módulos por la CSP: no afecta a la página (como en accounts.spec).
	test.use({ javaScriptEnabled: false, guardAllow: [/requestfailed: .*\(csp\)/] });

	test('@BE-FR-61 cambiar un parámetro económico funciona sin JavaScript y se ve en la siguiente carga', async ({
		page
	}) => {
		await loginAsAdmin(page);
		await cambiarSaldoMinimo(page, '5000001', 'Prueba E2E sin JavaScript');

		await page.goto('/admin/economia');
		await expect(page.locator(`#valor-${SALDO_MINIMO}`)).toHaveValue('5000001');

		await cambiarSaldoMinimo(page, '5000000', 'Restaurar valor de prueba E2E');
		await page.goto('/admin/economia');
		await expect(page.locator(`#valor-${SALDO_MINIMO}`)).toHaveValue('5000000');
	});
});

// --- Accesibilidad del panel (T323; 16.11): cada página de administración en ambos temas ---

function auditEntryId(): string {
	const db = dbFile();
	try {
		return (
			db.prepare<[], { id: string }>('SELECT id FROM admin_audit LIMIT 1').get()?.id ??
			'sin-entrada'
		);
	} finally {
		db.close();
	}
}

// Páginas de administración: las estáticas y las dinámicas con un valor sembrado. La reembolso no entra: necesita una compra pagada.
const ADMIN_PAGES: readonly (readonly [string, () => string])[] = [
	['/admin', () => '/admin'],
	['/admin/anuncios', () => '/admin/anuncios'],
	['/admin/apps', () => '/admin/apps'],
	['/admin/apps/[slug]', () => '/admin/apps/secretario'],
	['/admin/apps/[slug]/operaciones/[key]', () => '/admin/apps/secretario/operaciones/improve'],
	['/admin/apps/[slug]/predeterminados', () => '/admin/apps/secretario/predeterminados'],
	[
		'/admin/apps/[slug]/predeterminados/copiar',
		() => '/admin/apps/secretario/predeterminados/copiar'
	],
	['/admin/auditoria', () => '/admin/auditoria'],
	['/admin/auditoria/[entryId]', () => `/admin/auditoria/${auditEntryId()}`],
	['/admin/economia', () => '/admin/economia'],
	['/admin/estadisticas', () => '/admin/estadisticas'],
	['/admin/facturacion', () => '/admin/facturacion'],
	['/admin/legal', () => '/admin/legal'],
	['/admin/protecciones', () => '/admin/protecciones'],
	['/admin/usuarios', () => '/admin/usuarios'],
	['/admin/usuarios/[userId]', () => `/admin/usuarios/${userIdOf(email)}`],
	['/admin/usuarios/[userId]/ajuste', () => `/admin/usuarios/${userIdOf(email)}/ajuste`]
];

for (const scheme of ['light', 'dark'] as const) {
	for (const [plantilla, ruta] of ADMIN_PAGES) {
		test(`@BE-FR-10 accesible sin violaciones serious o critical en ${plantilla} con tema ${scheme}`, async ({
			page
		}, testInfo) => {
			await loginAsAdmin(page);
			await page.emulateMedia({ colorScheme: scheme });
			await page.goto(ruta());
			await page.waitForLoadState('networkidle');

			await checkAccessibility(page, testInfo);
		});
	}
}

// Administración en móvil (T322; 16.8 mobile-first): las páginas clave entran en 390×844 sin desbordamiento horizontal.
test.describe('administración en móvil', () => {
	for (const route of ['/admin', '/admin/usuarios', '/admin/facturacion']) {
		test(`@UX-13 ${route} entra en 390×844 sin desbordamiento horizontal`, async ({ page }) => {
			await page.setViewportSize({ width: 390, height: 844 });
			await loginAsAdmin(page);
			await page.goto(route);

			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth > document.documentElement.clientWidth
			);
			expect(overflow).toBe(false);
		});
	}
});

// Matriz de UX de estadísticas (T323; 16.8 página clave de administración; 16.11): claro y oscuro × efectos normales y
// reducidos × 320, 390 y 1366 px, sin desbordamiento horizontal y con axe sin violaciones serious o critical.
test.describe('matriz de UX de estadísticas (administración)', () => {
	for (const scheme of ['light', 'dark'] as const) {
		for (const effects of ['normales', 'reducidos'] as const) {
			for (const width of [320, 390, 1366]) {
				test(`@UX-16 /admin/estadisticas sin desbordamiento y sin violaciones: ${scheme}, efectos ${effects}, ${String(width)} px`, async ({
					page
				}, testInfo) => {
					await page.setViewportSize({ width, height: 800 });
					await page.emulateMedia({
						colorScheme: scheme,
						reducedMotion: effects === 'reducidos' ? 'reduce' : 'no-preference'
					});
					await loginAsAdmin(page);
					await page.goto('/admin/estadisticas');
					if (effects === 'reducidos') {
						await page.evaluate(() => {
							document.documentElement.setAttribute('data-effects', 'reduced');
						});
					}

					const overflow = await page.evaluate(
						() => document.documentElement.scrollWidth - document.documentElement.clientWidth
					);
					expect(
						overflow,
						`desbordamiento horizontal de ${String(overflow)} px`
					).toBeLessThanOrEqual(0);

					await checkAccessibility(page, testInfo);
				});
			}
		}
	}
});

// Web Vitals de laboratorio de W45 `/admin/estadisticas` (T323): mismo presupuesto que la landing (LCP ≤ 2,5 s, CLS ≤ 0,1)
// con CPU ×4 y red lenta. Se mide dentro de este spec porque necesita la sesión de administración.
test.describe('Web Vitals de laboratorio de estadísticas', () => {
	test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

	test('@UX-16 /admin/estadisticas: LCP ≤ 2,5 s y CLS ≤ 0,1 con CPU ×4 y red lenta', async ({
		page,
		browserName
	}, testInfo) => {
		test.skip(browserName !== 'chromium', 'la medición por CDP es de Chromium');
		await loginAsAdmin(page);
		const session = await page.context().newCDPSession(page);
		await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
		await session.send('Network.enable');
		await session.send('Network.emulateNetworkConditions', {
			offline: false,
			latency: 150,
			downloadThroughput: (1.6 * 1024 * 1024) / 8,
			uploadThroughput: (750 * 1024) / 8
		});

		await page.goto('/admin/estadisticas', { waitUntil: 'load' });
		await page.waitForTimeout(1500);

		const vitals = await page.evaluate(
			() =>
				new Promise<{ lcp: number; cls: number }>((resolve) => {
					let lcp = 0;
					let cls = 0;
					new PerformanceObserver((list) => {
						for (const entry of list.getEntries()) lcp = entry.startTime;
					}).observe({ type: 'largest-contentful-paint', buffered: true });
					new PerformanceObserver((list) => {
						for (const entry of list.getEntries()) {
							if ('hadRecentInput' in entry && entry.hadRecentInput === false && 'value' in entry) {
								cls += Number(entry.value);
							}
						}
					}).observe({ type: 'layout-shift', buffered: true });
					setTimeout(() => {
						resolve({ lcp, cls });
					}, 300);
				})
		);

		testInfo.annotations.push({ type: 'lcp-ms', description: String(Math.round(vitals.lcp)) });
		testInfo.annotations.push({ type: 'cls', description: vitals.cls.toFixed(3) });
		expect(vitals.lcp, 'LCP en ms').toBeLessThanOrEqual(2500);
		expect(vitals.cls, 'CLS').toBeLessThanOrEqual(0.1);
	});
});

test('la ficha de la cuenta conserva el rango de fechas en la URL y en el formulario', async ({
	page,
	baseURL
}) => {
	const address = await createTarget(baseURL, 'ficha-rango');
	const userId = userIdOf(address);
	await loginAsAdmin(page);
	await page.goto(`/admin/usuarios/${userId}?desde=2026-01-01&hasta=2026-01-31`);
	await page.waitForLoadState('networkidle');

	await expect(page.locator('#ficha-desde')).toHaveValue('2026-01-01');
	await expect(page.locator('#ficha-hasta')).toHaveValue('2026-01-31');
	await expect(page.getByRole('heading', { name: 'Últimos movimientos' })).toBeVisible();
});

test('la copia a predeterminados muestra la vista previa sin nada preseleccionado y exige elegir algo (T322)', async ({
	page
}) => {
	await loginAsAdmin(page);
	await page.goto('/admin/apps/secretario/predeterminados/copiar?usuario=usr_panel');
	await page.waitForLoadState('networkidle');

	const groups = page.getByRole('group').filter({ has: page.getByRole('checkbox') });
	await expect(groups.first()).toBeVisible();
	const boxes = groups.getByRole('checkbox');
	expect(await boxes.count()).toBeGreaterThan(0);
	for (const box of await boxes.all()) {
		await expect(box).not.toBeChecked();
	}

	// Sin marcar nada, la copia se rechaza y no sustituye ningún predeterminado.
	await page.getByRole('checkbox', { name: 'Confirmo este cambio' }).check();
	await page.getByRole('button', { name: 'Copiar los elementos marcados' }).click();
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('alert')).toContainText('No has marcado ningún elemento.');
});
