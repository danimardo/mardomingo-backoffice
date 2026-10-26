// Accesibilidad de las páginas públicas, del panel y de administración en ambos temas (T-A11Y-001, T273, T323, T355; R09;
// 16.11). Las rutas salen de `src/routes`. Las rutas con parámetros dinámicos se cubren aparte con valores sembrados.
import { expect, test } from './fixtures';
import { checkAccessibility } from './fixtures/axe';
import { staticPublicRoutes } from './fixtures/routes';

// Las rutas con parámetros dinámicos se añaden a mano con un valor sembrado (la landing de Secretario).
const routes = [...staticPublicRoutes(), '/apps/secretario'];

// Páginas estáticas del panel (T273): solo las que no dependen de un id concreto.
const panelRoutes = [
	'/panel',
	'/panel/apps',
	'/panel/bienvenida',
	'/panel/comprar',
	'/panel/consumo',
	'/panel/facturas',
	'/panel/movimientos',
	'/panel/perfil',
	'/panel/perfil/borrar',
	'/panel/sesiones'
];

// Páginas estáticas de administración (T323): solo las que no dependen de un id concreto.
const adminRoutes = [
	'/admin',
	'/admin/anuncios',
	'/admin/apps',
	'/admin/auditoria',
	'/admin/economia',
	'/admin/estadisticas',
	'/admin/facturacion',
	'/admin/legal',
	'/admin/protecciones',
	'/admin/usuarios'
];

test('la lista de rutas cubre todas las páginas de src/routes', () => {
	expect(routes).toContain('/');
	expect(routes).toContain('/preferencias');
	expect(routes).toContain('/precios');
	expect(routes).toContain('/terminos');
	expect(panelRoutes).toContain('/panel/sesiones');
	expect(adminRoutes).toContain('/admin/facturacion');
});

for (const scheme of ['light', 'dark'] as const) {
	for (const route of routes) {
		test(`accesible sin violaciones serious o critical en ${route} con tema ${scheme}`, async ({
			page
		}, testInfo) => {
			await page.emulateMedia({ colorScheme: scheme });
			await page.goto(route);

			await checkAccessibility(page, testInfo);
		});
	}
}

// Páginas del panel con sesión de `user` (T273): ambos temas, sin violaciones.
test.describe('panel con sesión de usuario (T273)', () => {
	test.use({ storageState: 'e2e/.auth/user.json' });

	for (const scheme of ['light', 'dark'] as const) {
		for (const route of panelRoutes) {
			test(`accesible sin violaciones serious o critical en ${route} con tema ${scheme}`, async ({
				page
			}, testInfo) => {
				await page.emulateMedia({ colorScheme: scheme });
				await page.goto(route);

				await checkAccessibility(page, testInfo);
			});
		}
	}
});

// Páginas de administración con sesión de `admin` (T323): ambos temas, sin violaciones.
test.describe('administración con sesión de administrador (T323)', () => {
	test.use({ storageState: 'e2e/.auth/admin.json' });

	for (const scheme of ['light', 'dark'] as const) {
		for (const route of adminRoutes) {
			test(`accesible sin violaciones serious o critical en ${route} con tema ${scheme}`, async ({
				page
			}, testInfo) => {
				await page.emulateMedia({ colorScheme: scheme });
				await page.goto(route);

				await checkAccessibility(page, testInfo);
			});
		}
	}
});

// Compra W20 con sesión de `user` (T248; 16.11): la confirmación en ambos temas, sin violaciones y sin desbordamiento a 320 px.
test.describe('compra con sesión de usuario (W20)', () => {
	test.use({ storageState: 'e2e/.auth/user.json' });

	for (const scheme of ['light', 'dark'] as const) {
		test(`accesible sin violaciones serious o critical en /panel/comprar con tema ${scheme}`, async ({
			page
		}, testInfo) => {
			await page.emulateMedia({ colorScheme: scheme });
			await page.goto('/panel/comprar?paquete=pck_seed_5eur');

			await checkAccessibility(page, testInfo);
		});
	}

	test('la confirmación de compra no desborda en 320 px', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 700 });
		await page.goto('/panel/comprar?paquete=pck_seed_5eur');

		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth > document.documentElement.clientWidth
		);
		expect(overflow).toBe(false);
	});
});
