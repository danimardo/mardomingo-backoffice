// Matriz completa de 16.11 (T357): login, saldo del panel, compra y estadísticas, con la misma cuadrícula de tema, efectos
// y anchos que `ux-matrix.spec.ts`. Solo corre en la nocturna: `playwright.config.ts` la excluye si no hay `E2E_NIGHTLY=1`.
// Las páginas con sesión usan los estados de `e2e/.auth/`; la de estadísticas, el del administrador (un único administrador).
import { expect, test } from './fixtures';
import { checkAccessibility } from './fixtures/axe';

const WIDTHS = [320, 390, 1366];
const EFFECTS = ['normales', 'reducidos'] as const;

async function applyEffects(
	page: import('@playwright/test').Page,
	effects: (typeof EFFECTS)[number]
): Promise<void> {
	await page.evaluate((value) => {
		if (value === 'reducidos') document.documentElement.setAttribute('data-effects', 'reduced');
		else document.documentElement.removeAttribute('data-effects');
	}, effects);
}

// Matriz completa de 16.11 (T357): login, saldo del panel, compra y estadísticas, con la misma cuadrícula de tema, efectos
// y anchos. Solo en la nocturna (`E2E_NIGHTLY=1`): la validación diaria no la ejecuta para no alargarla. Las páginas con
// sesión usan los estados de `e2e/.auth/`; la de estadísticas, el del administrador (un único administrador por base).
const FULL_PAGES = [
	{ route: '/login', storage: undefined },
	{ route: '/panel', storage: 'e2e/.auth/user.json' },
	{ route: '/panel/comprar', storage: 'e2e/.auth/user.json' },
	{ route: '/admin/estadisticas', storage: 'e2e/.auth/admin.json' }
] as const;

test.describe('matriz completa (nocturna)', () => {
	for (const scheme of ['light', 'dark'] as const) {
		for (const effects of EFFECTS) {
			for (const width of WIDTHS) {
				for (const { route, storage } of FULL_PAGES) {
					test(`@UX-16 ${route} sin desbordamiento y sin violaciones: ${scheme}, efectos ${effects}, ${String(width)} px`, async ({
						browser
					}, testInfo) => {
						const context = await browser.newContext({
							viewport: { width, height: 800 },
							colorScheme: scheme,
							reducedMotion: effects === 'reducidos' ? 'reduce' : 'no-preference',
							...(storage === undefined ? {} : { storageState: storage })
						});
						const page = await context.newPage();
						try {
							await page.goto(route);
							await applyEffects(page, effects);

							const overflow = await page.evaluate(
								() => document.documentElement.scrollWidth - document.documentElement.clientWidth
							);
							expect(
								overflow,
								`desbordamiento horizontal de ${String(overflow)} px`
							).toBeLessThanOrEqual(0);

							await checkAccessibility(page, testInfo);
						} finally {
							await context.close();
						}
					});
				}
			}
		}
	}
});
