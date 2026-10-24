// Web Vitals de laboratorio (T355, T275, T371; constitución, «Rendimiento percibido»): LCP ≤ 2,5 s y CLS ≤ 0,1 sobre el build
// con CPU y red limitadas (perfil móvil), con efectos normales y reducidos (cookie `mdm_effects`). INP necesita una interacción
// medida: queda «pendiente» aquí. Son medidas de laboratorio, no datos de campo. Cubre landing, login, saldo del panel y compra;
// las estadísticas de administración tienen su propia medición en `admin-contenido.spec.ts` (con la cuenta `admin`, para no
// duplicar la sesión de administración en este spec). Además, el presupuesto del cristal: CLS
// tras desplazar, redimensionar y abrir el menú de cuenta en perfil móvil.
import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from '../fixtures';
import { recordUx } from '../fixtures/ux-emulation';

const LCP_BUDGET_MS = 2500;
const CLS_BUDGET = 0.1;

type Effects = 'normal' | 'reduced';

interface Vitals {
	readonly lcp: number;
	readonly cls: number;
}

/** Fija el modo de efectos con la cookie que lee la aplicación (W16). */
async function setEffects(page: Page, effects: Effects, testInfo: TestInfo): Promise<void> {
	if (effects === 'normal') return;
	const url = testInfo.project.use.baseURL ?? 'http://localhost:7390';
	await page.context().addCookies([{ name: 'mdm_effects', value: 'reduced', url }]);
}

/** Observa LCP y CLS de la página desde su carga; `settle` deja tiempo a las interacciones. */
async function observe(page: Page, settleMs: number): Promise<Vitals> {
	return page.evaluate(
		(ms) =>
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
				}, ms);
			}),
		settleMs
	);
}

/** Mide LCP y CLS de la página ya cargada, con CPU ×4 y red lenta (perfil móvil de Lighthouse). */
async function measure(
	page: Page,
	route: string,
	effects: Effects,
	testInfo: TestInfo
): Promise<Vitals> {
	const session = await page.context().newCDPSession(page);
	await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
	await session.send('Network.enable');
	await session.send('Network.emulateNetworkConditions', {
		offline: false,
		latency: 150,
		downloadThroughput: (1.6 * 1024 * 1024) / 8,
		uploadThroughput: (750 * 1024) / 8
	});

	await setEffects(page, effects, testInfo);
	await page.goto(route, { waitUntil: 'load' });
	await page.waitForTimeout(1500);
	const vitals = await observe(page, 300);

	testInfo.annotations.push({ type: 'lcp-ms', description: String(Math.round(vitals.lcp)) });
	testInfo.annotations.push({ type: 'cls', description: vitals.cls.toFixed(3) });
	expect(vitals.lcp, `LCP en ms (${effects})`).toBeLessThanOrEqual(LCP_BUDGET_MS);
	expect(vitals.cls, `CLS (${effects})`).toBeLessThanOrEqual(CLS_BUDGET);
	recordUx(
		testInfo,
		'web-vitals-lcp-cls',
		'comprobado',
		`${route} (${effects}): LCP ${String(Math.round(vitals.lcp))} ms, CLS ${vitals.cls.toFixed(3)} (laboratorio)`
	);
	recordUx(testInfo, 'web-vitals-inp', 'pendiente', 'INP requiere una interacción medida');
	return vitals;
}

const PUBLIC_ROUTES = ['/', '/apps/secretario', '/login'] as const;
const PANEL_ROUTES = ['/panel', '/panel/comprar?paquete=pck_seed_5eur'] as const;

const EFFECTS: readonly Effects[] = ['normal', 'reduced'];

test.describe('Web Vitals de laboratorio (perfil móvil)', () => {
	test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

	for (const effects of EFFECTS) {
		for (const route of PUBLIC_ROUTES) {
			test(`@UX-16 ${route} (${effects}): LCP ≤ 2,5 s y CLS ≤ 0,1 con CPU ×4 y red lenta`, async ({
				page,
				browserName
			}, testInfo) => {
				test.skip(browserName !== 'chromium', 'la medición por CDP es de Chromium');
				await measure(page, route, effects, testInfo);
			});
		}
	}
});

test.describe('Web Vitals de laboratorio con sesión (saldo y compra)', () => {
	test.use({
		viewport: { width: 390, height: 844 },
		isMobile: true,
		hasTouch: true,
		storageState: 'e2e/.auth/user.json'
	});

	for (const effects of EFFECTS) {
		for (const route of PANEL_ROUTES) {
			test(`@UX-16 ${route} (${effects}): LCP ≤ 2,5 s y CLS ≤ 0,1 con CPU ×4 y red lenta`, async ({
				page,
				browserName
			}, testInfo) => {
				test.skip(browserName !== 'chromium', 'la medición por CDP es de Chromium');
				await measure(page, route, effects, testInfo);
			});
		}
	}
});

// Presupuesto del cristal (T371): desplazar, redimensionar y abrir el menú de cuenta no deben desplazar el contenido (CLS).
test.describe('presupuesto del cristal en perfil móvil (T371)', () => {
	test.use({
		viewport: { width: 390, height: 844 },
		isMobile: true,
		hasTouch: true,
		storageState: 'e2e/.auth/user.json'
	});

	for (const effects of EFFECTS) {
		test(`@UX-16 /panel (${effects}): desplazar, redimensionar y abrir el menú no suben el CLS por encima de 0,1`, async ({
			page,
			browserName
		}, testInfo) => {
			test.skip(browserName !== 'chromium', 'la medición por CDP es de Chromium');
			await setEffects(page, effects, testInfo);
			await page.goto('/panel', { waitUntil: 'load' });
			await page.waitForTimeout(1500);

			await page.evaluate(() => {
				window.scrollTo(0, document.body.scrollHeight);
			});
			await page.waitForTimeout(200);
			await page.setViewportSize({ width: 320, height: 700 });
			await page.waitForTimeout(200);
			await page.setViewportSize({ width: 390, height: 844 });
			await page.waitForTimeout(200);

			// El menú de cuenta es un `<details>` con su `<summary>` (`AccountMenu.svelte`).
			const menu = page.locator('details > summary', { hasText: 'Cuenta' }).first();
			const menuOpened = (await menu.count()) > 0;
			if (menuOpened) {
				await menu.click();
				await page.waitForTimeout(300);
			}

			const vitals = await observe(page, 300);
			testInfo.annotations.push({ type: 'cls-interaccion', description: vitals.cls.toFixed(3) });
			expect(vitals.cls, `CLS tras las interacciones (${effects})`).toBeLessThanOrEqual(CLS_BUDGET);
			recordUx(
				testInfo,
				'cristal-presupuesto',
				menuOpened ? 'comprobado' : 'pendiente',
				menuOpened
					? `/panel (${effects}): CLS ${vitals.cls.toFixed(3)} tras desplazar, redimensionar y abrir el menú`
					: `/panel (${effects}): no hay menú de cuenta con ese nombre; CLS ${vitals.cls.toFixed(3)} tras desplazar y redimensionar`
			);
		});
	}
});
