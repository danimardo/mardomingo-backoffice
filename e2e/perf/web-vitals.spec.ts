// Web Vitals de laboratorio de la landing (T355; constitución, «Rendimiento percibido»): LCP ≤ 2,5 s y CLS ≤ 0,1 sobre el build
// con CPU y red limitadas (perfil móvil). INP necesita una interacción medida: queda «pendiente» aquí. Son medidas de laboratorio,
// no datos de campo.
import { expect, test } from '../fixtures';
import { recordUx } from '../fixtures/ux-emulation';

const LCP_BUDGET_MS = 2500;
const CLS_BUDGET = 0.1;

test.describe('Web Vitals de laboratorio (perfil móvil)', () => {
	test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

	for (const route of ['/', '/apps/secretario']) {
		test(`@UX-16 ${route}: LCP ≤ 2,5 s y CLS ≤ 0,1 con CPU ×4 y red lenta`, async ({
			page,
			browserName
		}, testInfo) => {
			test.skip(browserName !== 'chromium', 'la medición por CDP es de Chromium');
			const session = await page.context().newCDPSession(page);
			await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
			await session.send('Network.enable');
			await session.send('Network.emulateNetworkConditions', {
				offline: false,
				latency: 150,
				downloadThroughput: (1.6 * 1024 * 1024) / 8,
				uploadThroughput: (750 * 1024) / 8
			});

			await page.goto(route, { waitUntil: 'load' });
			await page.waitForTimeout(1500);

			const vitals = await page.evaluate(
				() =>
					new Promise<{ lcp: number; cls: number }>((resolve) => {
						let lcp = 0;
						let cls = 0;
						new PerformanceObserver((list) => {
							for (const entry of list.getEntries()) {
								lcp = entry.startTime;
							}
						}).observe({ type: 'largest-contentful-paint', buffered: true });
						new PerformanceObserver((list) => {
							for (const entry of list.getEntries()) {
								if (
									'hadRecentInput' in entry &&
									entry.hadRecentInput === false &&
									'value' in entry
								) {
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
			expect(vitals.lcp, 'LCP en ms').toBeLessThanOrEqual(LCP_BUDGET_MS);
			expect(vitals.cls, 'CLS').toBeLessThanOrEqual(CLS_BUDGET);
			recordUx(
				testInfo,
				'web-vitals-lcp-cls',
				'comprobado',
				`${route}: LCP ${String(Math.round(vitals.lcp))} ms, CLS ${vitals.cls.toFixed(3)} (laboratorio)`
			);
			recordUx(testInfo, 'web-vitals-inp', 'pendiente', 'INP requiere una interacción medida');
		});
	}
});
