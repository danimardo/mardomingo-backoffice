// La política de privacidad es de la plataforma y enumera las apps y los proveedores que tratan datos (BE-FR-63 CA3).
// El texto es provisional (T092): la prueba fija que el listado existe y que no se olvida ningún proveedor de la v4.
import { describe, expect, it } from 'vitest';
import { PROVISIONAL_TEXTS } from './seed';

const PROVIDERS = ['OpenRouter', 'Mistral', 'Resend', 'Cloudflare Turnstile'];

describe('política de privacidad de la plataforma (BE-FR-63)', () => {
	it('[BE-FR-63/CA3] enumera las apps y los proveedores que procesan datos', () => {
		const privacy = PROVISIONAL_TEXTS.privacy;

		expect(privacy).toContain('6. Apps y proveedores');
		expect(privacy).toContain('Secretario AI');
		for (const provider of PROVIDERS) {
			expect(privacy).toContain(provider);
		}
	});
});
