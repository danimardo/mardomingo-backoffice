// HMAC-SHA256 del email normalizado (T087; D-11; BE-FR-11.5). La clave llega por parámetro y nunca se rota.
import { describe, expect, it } from 'vitest';
import { hashNormalizedEmail } from './email-hash';

describe('hashNormalizedEmail', () => {
	it('coincide con el vector conocido de HMAC-SHA256 (clave «key»)', () => {
		expect(hashNormalizedEmail('The quick brown fox jumps over the lazy dog', 'key')).toBe(
			'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8'
		);
	});

	it('es determinista para la misma clave y el mismo email', () => {
		const first = hashNormalizedEmail('juan@gmail.com', 'clave-de-prueba-de-32-caracteres!!');
		const second = hashNormalizedEmail('juan@gmail.com', 'clave-de-prueba-de-32-caracteres!!');
		expect(first).toBe(second);
	});

	it('con otra clave o con otro email, el resultado cambia', () => {
		const base = hashNormalizedEmail('juan@gmail.com', 'clave-uno-de-32-caracteres-minimo!!');
		expect(hashNormalizedEmail('juan@gmail.com', 'clave-dos-de-32-caracteres-minimo!!')).not.toBe(
			base
		);
		expect(hashNormalizedEmail('ana@gmail.com', 'clave-uno-de-32-caracteres-minimo!!')).not.toBe(
			base
		);
	});
});
