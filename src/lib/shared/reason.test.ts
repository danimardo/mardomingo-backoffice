// Motivo de las acciones de administración (BE-FR-55; C-55, R08 y D09): de 1 a 500 caracteres tras recortar. Puro.
import { describe, expect, it } from 'vitest';
import { REASON_MAX_LENGTH, reasonIssueOf } from './reason';

describe('motivo de 1 a 500 caracteres (C-55)', () => {
	it('el máximo común es 500', () => {
		expect(REASON_MAX_LENGTH).toBe(500);
	});

	it('vacío o solo espacios es obligatorio', () => {
		expect(reasonIssueOf('')).toBe('validation_required');
		expect(reasonIssueOf('   \n\t')).toBe('validation_required');
	});

	it('de 1 a 500 caracteres tras recortar es válido', () => {
		expect(reasonIssueOf('a')).toBeNull();
		expect(reasonIssueOf('x'.repeat(500))).toBeNull();
		expect(reasonIssueOf(`  ${'x'.repeat(500)}  `)).toBeNull();
	});

	it('más de 500 caracteres tras recortar es demasiado largo', () => {
		expect(reasonIssueOf('x'.repeat(501))).toBe('reason_too_long');
	});
});
