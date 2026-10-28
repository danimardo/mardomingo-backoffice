// Formato del slug de una app (D10 = R15 de la propuesta de administración): de 2 a 40 caracteres, empieza por letra minúscula y
// sigue con minúsculas, dígitos o guiones. Puro.
import { describe, expect, it } from 'vitest';
import { isValidSlug } from './slug';

describe('formato del slug (D10)', () => {
	it('acepta el mínimo de dos caracteres y rechaza uno solo', () => {
		expect(isValidSlug('ab')).toBe(true);
		expect(isValidSlug('a')).toBe(false);
	});

	it('acepta el máximo de cuarenta caracteres y rechaza cuarenta y uno', () => {
		expect(isValidSlug(`a${'b'.repeat(39)}`)).toBe(true);
		expect(isValidSlug(`a${'b'.repeat(40)}`)).toBe(false);
	});

	it('empieza obligatoriamente por una letra minúscula', () => {
		expect(isValidSlug('1ab')).toBe(false);
		expect(isValidSlug('-ab')).toBe(false);
		expect(isValidSlug('Ab')).toBe(false);
	});

	it('solo admite minúsculas, dígitos y guion, también al final', () => {
		expect(isValidSlug('ab-c2')).toBe(true);
		expect(isValidSlug('ab-')).toBe(true);
		expect(isValidSlug('ab_c')).toBe(false);
		expect(isValidSlug('ab c')).toBe(false);
		expect(isValidSlug('ab.c')).toBe(false);
		expect(isValidSlug('ábc')).toBe(false);
	});

	it('la cadena vacía no es un slug', () => {
		expect(isValidSlug('')).toBe(false);
	});
});
