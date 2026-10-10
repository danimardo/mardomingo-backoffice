// Accesibilidad de las páginas públicas en ambos temas (T-A11Y-001; R09; 16.11). Las rutas salen de `src/routes`.
import { expect, test } from './fixtures';
import { checkAccessibility } from './fixtures/axe';
import { staticPublicRoutes } from './fixtures/routes';

const routes = staticPublicRoutes();

test('la lista de rutas cubre todas las páginas de src/routes', () => {
	expect(routes).toContain('/');
	expect(routes).toContain('/preferencias');
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
