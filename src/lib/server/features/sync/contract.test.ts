// Lectura de `If-Match` (D-19; T216): solo enteros seguros en forma decimal.
import { describe, expect, it } from 'vitest';
import { parseIfMatch } from './contract';

describe('parseIfMatch', () => {
	it('lee una revisión decimal', () => {
		expect(parseIfMatch('3')).toBe(3);
		expect(parseIfMatch('0')).toBe(0);
	});

	it('ausente, vacía o con letras, signos o decimales es null', () => {
		expect(parseIfMatch(null)).toBeNull();
		expect(parseIfMatch('')).toBeNull();
		expect(parseIfMatch('3a')).toBeNull();
		expect(parseIfMatch('-1')).toBeNull();
		expect(parseIfMatch('1.5')).toBeNull();
		expect(parseIfMatch('"3"')).toBeNull();
	});

	it('un número mayor que el entero seguro es null', () => {
		expect(parseIfMatch('9007199254740993')).toBeNull();
	});
});
