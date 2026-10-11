// Formato de los importes en créditos (BE-FR-22; SC-007; D-07; T120). Los ejemplos de BE-FR-22 son fixtures exactos. El
// signo menos es U+2212, como en la especificación.
import { describe, expect, it } from 'vitest';
import { formatCredits } from './credits';

describe('formatCredits', () => {
	it('los ejemplos de BE-FR-22 salen exactos (D-07)', () => {
		expect(formatCredits(776_480)).toBe('0,8');
		expect(formatCredits(3_680_000)).toBe('3,7');
		expect(formatCredits(58_236_000)).toBe('58');
		expect(formatCredits(-3_236_000)).toBe('−3,2');
	});

	it('a partir de 10 créditos no muestra decimales', () => {
		expect(formatCredits(10_000_000)).toBe('10');
		expect(formatCredits(58_236_000)).toBe('58');
		expect(formatCredits(4_996_764_000)).toBe('4997');
		expect(formatCredits(12_345_000_000)).toBe('12.345');
	});

	it('entre 0,1 y 10 muestra un decimal', () => {
		expect(formatCredits(100_000)).toBe('0,1');
		expect(formatCredits(1_500_000)).toBe('1,5');
		expect(formatCredits(9_400_000)).toBe('9,4');
	});

	it('un importe positivo menor que 0,1 se muestra como «< 0,1»', () => {
		expect(formatCredits(1)).toBe('< 0,1');
		expect(formatCredits(99_999)).toBe('< 0,1');
	});

	it('cero se muestra como 0', () => {
		expect(formatCredits(0)).toBe('0');
	});

	it('los negativos llevan el signo menos U+2212 delante del mismo formato', () => {
		expect(formatCredits(-1_000_000_000)).toBe('−1000');
		expect(formatCredits(-12_000_000_000)).toBe('−12.000');
		expect(formatCredits(-50_000)).toBe('−< 0,1');
	});

	it('usa coma decimal y el agrupado de miles de es-ES (sin separador a partir de 4 cifras, como la RAE)', () => {
		expect(formatCredits(1_234_567_000)).toBe('1235');
		expect(formatCredits(1_234_567_000_000)).toBe('1.234.567');
	});
});
