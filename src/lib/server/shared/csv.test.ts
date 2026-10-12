// Serializador CSV común (BE-FR-49.6, BE-FR-76; T239): separador `;`, coma decimal, escape de comillas y saltos, BOM para hojas
// de cálculo y sin fórmulas inyectables al empezar por `=`, `+`, `-` o `@` (solo en texto, nunca en números).
import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from './csv';

describe('csvCell', () => {
	it('separa con punto y coma y no entrecomilla lo simple', () => {
		expect(csvCell('hola')).toBe('hola');
		expect(toCsv([['a', 'b']])).toBe('a;b\r\n');
	});

	it('usa coma decimal en los números y no añade ceros', () => {
		expect(csvCell(12.5)).toBe('12,5');
		expect(csvCell(10)).toBe('10');
		expect(csvCell(-400)).toBe('-400');
	});

	it('entrecomilla y duplica las comillas cuando hay separador, comilla o salto', () => {
		expect(csvCell('uno;dos')).toBe('"uno;dos"');
		expect(csvCell('di "hola"')).toBe('"di ""hola"""');
		expect(csvCell('línea\nnueva')).toBe('"línea\nnueva"');
		expect(csvCell('retorno\rcarro')).toBe('"retorno\rcarro"');
	});

	it('neutraliza las fórmulas: un texto que empieza por = + - @ se prefija con comilla simple', () => {
		expect(csvCell('=SUMA(A1)')).toBe("'=SUMA(A1)");
		expect(csvCell('+34')).toBe("'+34");
		expect(csvCell('-cuenta')).toBe("'-cuenta");
		expect(csvCell('@importar')).toBe("'@importar");
	});

	it('los números negativos no se neutralizan: son importes', () => {
		expect(toCsv([[-12.5]])).toBe('-12,5\r\n');
	});

	it('nulos y no definidos son vacíos y los booleanos se escriben en español', () => {
		expect(csvCell(null)).toBe('');
		expect(csvCell(undefined)).toBe('');
		expect(csvCell(true)).toBe('sí');
		expect(csvCell(false)).toBe('no');
	});

	it('rechaza números que no son finitos', () => {
		expect(() => csvCell(Number.NaN)).toThrow(RangeError);
		expect(() => csvCell(Number.POSITIVE_INFINITY)).toThrow(RangeError);
	});
});

describe('toCsv', () => {
	it('escribe la cabecera primero y cada fila en su línea', () => {
		expect(toCsv([['1', 'x']], { header: ['id', 'nombre'] })).toBe('id;nombre\r\n1;x\r\n');
	});

	it('añade BOM UTF-8 cuando el destino es una hoja de cálculo', () => {
		expect(toCsv([['ñ']], { bom: true })).toBe('﻿ñ\r\n');
		expect(toCsv([['ñ']])).toBe('ñ\r\n');
	});

	it('sin filas devuelve solo la cabecera, o nada', () => {
		expect(toCsv([], { header: ['a'] })).toBe('a\r\n');
		expect(toCsv([])).toBe('');
	});
});
