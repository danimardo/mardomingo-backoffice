// Normalización del email para el saldo de bienvenida y el bloqueo por intentos (T086; BE-FR-11 CA1, BE-FR-11.5).
// Se escribe antes que la implementación: debe fallar hasta que `email.ts` exista.
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { normalizeEmail } from './email';

describe('normalizeEmail', () => {
	it('pasa a minúsculas', () => {
		expect(normalizeEmail('JUAN@Ejemplo.ES')).toBe('juan@ejemplo.es');
	});

	it('quita el sufijo +etiqueta en cualquier dominio', () => {
		expect(normalizeEmail('juan+2@ejemplo.es')).toBe('juan@ejemplo.es');
		expect(normalizeEmail('juan+compras+2@ejemplo.es')).toBe('juan@ejemplo.es');
	});

	it('en gmail.com quita los puntos del nombre y unifica googlemail.com', () => {
		expect(normalizeEmail('j.uan@gmail.com')).toBe('juan@gmail.com');
		expect(normalizeEmail('j.uan@googlemail.com')).toBe('juan@gmail.com');
	});

	it('no quita los puntos fuera de gmail.com', () => {
		expect(normalizeEmail('j.uan@ejemplo.es')).toBe('j.uan@ejemplo.es');
	});

	it('los ejemplos de la especificación dan la misma forma', () => {
		const forms = ['juan+2@gmail.com', 'j.uan@googlemail.com', 'JUAN@gmail.com'].map(
			normalizeEmail
		);
		expect(new Set(forms)).toEqual(new Set(['juan@gmail.com']));
	});

	it('es idempotente: normalizar dos veces da lo mismo que una', () => {
		fc.assert(
			fc.property(
				fc.emailAddress(),
				(email) => normalizeEmail(normalizeEmail(email)) === normalizeEmail(email)
			)
		);
	});
});
