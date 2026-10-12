// Identificadores fiscales (BE-FR-74 CA2; T227): NIF, NIE y CIF españoles con su letra o dígito de control, y NIF-IVA
// intracomunitario solo por formato (la comprobación en VIES queda pendiente).
import { describe, expect, it } from 'vitest';
import { isValidEsTaxId, isValidVatFormat, normalizeTaxId } from './tax-id';

describe('normalizeTaxId', () => {
	it('quita espacios y guiones y pasa a mayúsculas', () => {
		expect(normalizeTaxId(' 12345678-z ')).toBe('12345678Z');
	});
});

describe('isValidEsTaxId: NIF', () => {
	it('acepta un NIF con su letra correcta, en minúsculas o con espacios', () => {
		expect(isValidEsTaxId('12345678Z')).toBe(true);
		expect(isValidEsTaxId('12345678z')).toBe(true);
		expect(isValidEsTaxId('12345678 Z')).toBe(true);
	});

	it('rechaza un NIF con otra letra', () => {
		expect(isValidEsTaxId('12345678A')).toBe(false);
	});

	it('rechaza un NIF de formato incorrecto', () => {
		expect(isValidEsTaxId('1234567Z')).toBe(false);
		expect(isValidEsTaxId('')).toBe(false);
	});
});

describe('isValidEsTaxId: NIE', () => {
	it('acepta un NIE con X, Y o Z y su letra correcta', () => {
		expect(isValidEsTaxId('X0000000T')).toBe(true);
		expect(isValidEsTaxId('Y0000000Z')).toBe(true);
	});

	it('rechaza un NIE con letra incorrecta', () => {
		expect(isValidEsTaxId('X0000000A')).toBe(false);
	});
});

describe('isValidEsTaxId: CIF', () => {
	it('acepta un CIF con su dígito de control', () => {
		expect(isValidEsTaxId('A58818501')).toBe(true);
	});

	it('rechaza un CIF con otro dígito de control', () => {
		expect(isValidEsTaxId('A58818502')).toBe(false);
	});

	it('rechaza un CIF que no empieza por una letra de organización', () => {
		expect(isValidEsTaxId('Ñ58818501')).toBe(false);
	});
});

describe('isValidVatFormat: NIF-IVA intracomunitario (solo formato)', () => {
	it('acepta el formato de un NIF-IVA de otro país de la UE', () => {
		expect(isValidVatFormat('FR12345678901')).toBe(true);
	});

	it('acepta el NIF-IVA español cuando su documento es válido', () => {
		expect(isValidVatFormat('ES12345678Z')).toBe(true);
	});

	it('rechaza un NIF-IVA español con documento inválido', () => {
		expect(isValidVatFormat('ES12345678A')).toBe(false);
	});

	it('rechaza un código de país que no son dos letras', () => {
		expect(isValidVatFormat('1212345678')).toBe(false);
	});
});
