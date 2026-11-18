// Poppins propia (T455, DS-04/DS-11, constitución XIII): las fuentes salen del propio servidor, con tipo de fuente, y la
// CSP no abre `font-src` a terceros. La portada precarga solo los pesos 400 y 600.
import { describe, expect, inject, it } from 'vitest';
import { send } from './client';

const baseUrl = inject('httpBaseUrl');
const port = new URL(baseUrl).port;
const host = `localhost:${port}`;
const WEIGHTS = [400, 500, 600, 700];

describe('Poppins servida desde el propio servidor', () => {
	it.each(WEIGHTS.map(String))(
		'/fonts/poppins/poppins-latin-%s-normal.woff2 responde 200 con tipo de fuente',
		async (weight) => {
			const result = await send(baseUrl, `/fonts/poppins/poppins-latin-${weight}-normal.woff2`, {
				host
			});

			expect(result.status).toBe(200);
			expect(String(result.headers['content-type'])).toMatch(
				/font\/woff2|application\/(font-woff2|octet-stream)/
			);
		}
	);

	it('la licencia OFL se sirve junto a las fuentes', async () => {
		const result = await send(baseUrl, '/fonts/poppins/OFL-Poppins.txt', { host });

		expect(result.status).toBe(200);
		expect(result.text).toContain('SIL OPEN FONT LICENSE');
	});

	it('la CSP limita font-src a self y no nombra proveedores de fuentes', async () => {
		const page = await send(baseUrl, '/', { host });
		const csp = String(page.headers['content-security-policy']);

		expect(csp).toMatch(/font-src 'self'(;|$)/);
		expect(csp).not.toMatch(/fonts\.(googleapis|gstatic)\.com|fontshare|typekit|bunny\.net|cdn/i);
	});

	it('la portada precarga solo el 400 y el 600, same-origin y con crossorigin', async () => {
		const page = await send(baseUrl, '/', { host });
		const links = [...page.text.matchAll(/<link[^>]*rel="preload"[^>]*as="font"[^>]*>/g)].map(
			(m) => m[0]
		);

		expect(links).toHaveLength(2);
		for (const link of links) {
			expect(link).toContain('type="font/woff2"');
			expect(link).toContain('crossorigin');
			expect(link).toMatch(/href="\/fonts\/poppins\/poppins-latin-(400|600)-normal\.woff2"/);
		}
	});
});
