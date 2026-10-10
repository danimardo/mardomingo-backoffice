// Fixture base de las pruebas E2E (T-PLAY-001). Cada prueba importa `test` y `expect` de aquí.
// El fixture automático `guard` falla la prueba ante cualquier `pageerror`, `console.error`, petición fallida,
// respuesta 5xx o petición a un origen distinto del de la aplicación (Historias.md 15.17).
import { test as base, expect } from '@playwright/test';

// Marca de «no recargado» que usan las pruebas de navegación sin recarga.
declare global {
	interface Window {
		__sinRecarga?: boolean;
	}
}

interface GuardOptions {
	/** Mensajes de consola o respuestas esperadas por la prueba (p. ej. un 404 de la página de error). */
	guardAllow: readonly RegExp[];
}

export const test = base.extend<GuardOptions & { guard: undefined }>({
	guardAllow: [[], { option: true }],
	guard: [
		async ({ page, baseURL, guardAllow }, use) => {
			const origin = new URL(baseURL ?? 'http://localhost:7390').origin;
			const problems: string[] = [];
			const allowed = (text: string): boolean => guardAllow.some((pattern) => pattern.test(text));
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
