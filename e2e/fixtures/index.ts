// Fixture base de las pruebas E2E (T-PLAY-001). Cada prueba importa `test` y `expect` de aquí.
// El fixture automático `guard` falla la prueba ante cualquier `pageerror`, `console.error`, petición fallida,
// respuesta 5xx o petición a un origen distinto del de la aplicación (Historias.md 15.17).
import { test as base, expect } from '@playwright/test';

// Marca de «no recargado» que usan las pruebas de navegación sin recarga.
declare global {
	interface Window {
		__sinRecarga?: boolean;
		/** INP de laboratorio medido por `e2e/perf/web-vitals.spec.ts` (T371). */
		__inp?: number;
	}
}

interface GuardOptions {
	/** Mensajes de consola o respuestas esperadas por la prueba (p. ej. un 404 de la página de error). */
	guardAllow: readonly RegExp[];
}

export const test = base.extend<GuardOptions & { guard: undefined }>({
	guardAllow: [[], { option: true }],
	guard: [
		async ({ page, baseURL, guardAllow, browserName }, use) => {
			const origin = new URL(baseURL ?? 'http://localhost:7390').origin;
			const problems: string[] = [];
			// WebKit inyecta por su cuenta una hoja de estilos en las páginas con un campo de contraseña (autorrelleno)
			// y nuestra CSP (`style-src 'self'`) la bloquea. No viene de la aplicación ni tiene efecto visible: se admite
			// solo en WebKit; la CSP no se relaja. Con JavaScript desactivado, WebKit además cancela la precarga de los módulos
			// de la aplicación (`requestfailed ... Load request cancelled`): es lo esperado y no afecta a la página. La exportación es una
			// descarga: WebKit cancela esa navegación y la reporta como `Frame load interrupted`; la descarga la comprueba su prueba.
			const webkitNoise =
				/Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline'|requestfailed: \S+\/_app\/immutable\/\S+\.js \(Load request cancelled\)|requestfailed: \S+\/panel\/perfil\/exportar \(Frame load interrupted\)/;
			const allowed = (text: string): boolean =>
				guardAllow.some((pattern) => pattern.test(text)) ||
				(browserName === 'webkit' && webkitNoise.test(text));
			const report = (text: string): void => {
				if (!allowed(text)) problems.push(text);
			};

			page.on('pageerror', (error) => {
				report(`pageerror: ${error.message}`);
			});
			page.on('console', (message) => {
				if (message.type() === 'error') report(`console.error: ${message.text()}`);
			});
			page.on('requestfailed', (request) => {
				report(`requestfailed: ${request.url()} (${request.failure()?.errorText ?? 'sin motivo'})`);
			});
			page.on('response', (response) => {
				if (response.status() >= 500) report(`5xx: ${String(response.status())} ${response.url()}`);
			});
			page.on('request', (request) => {
				const url = new URL(request.url());
				if (url.protocol === 'data:' || url.protocol === 'blob:') return;
				if (url.origin !== origin) report(`externo: ${request.url()}`);
			});

			await use(undefined);
			expect(problems, problems.join('\n')).toEqual([]);
		},
		{ auto: true }
	]
});

export { expect };
