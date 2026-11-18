// Regla única del motivo en los servicios (BE-FR-55; C-55): `VALIDATION_ERROR` en `reason` si está vacío o pasa de 500
// caracteres tras recortar; si es válido, devuelve el motivo recortado, que es el que se audita.
import { describe, expect, it } from 'vitest';
import { AppError } from './errors';
import { requireReason } from './reason';

function errorOf(reason: string): unknown {
	try {
		requireReason(reason);
	} catch (cause) {
		return cause;
	}
	return null;
}

describe('requireReason (C-55)', () => {
	it('devuelve el motivo sin los espacios de los extremos', () => {
		expect(requireReason('  Revisión  ')).toBe('Revisión');
		expect(requireReason('x'.repeat(500))).toBe('x'.repeat(500));
	});

	it.each(['', '   ', 'x'.repeat(501), ` ${'x'.repeat(501)} `])(
		'rechaza un motivo vacío o de más de 500 caracteres (%#)',
		(reason) => {
			const cause = errorOf(reason);
			expect(cause).toBeInstanceOf(AppError);
			expect(cause).toMatchObject({ code: 'VALIDATION_ERROR', details: { field: 'reason' } });
		}
	);
});
