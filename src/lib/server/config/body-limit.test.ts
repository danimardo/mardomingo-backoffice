// Tamaños de `BODY_SIZE_LIMIT` (T185).
import { describe, expect, it } from 'vitest';
import { bodyLimitBytes } from './body-limit';

describe('bodyLimitBytes', () => {
	it('entiende las unidades K, M y G, y los bytes sin unidad', () => {
		expect(bodyLimitBytes('10M')).toBe(10 * 1024 * 1024);
		expect(bodyLimitBytes('512K')).toBe(512 * 1024);
		expect(bodyLimitBytes('1G')).toBe(1024 ** 3);
		expect(bodyLimitBytes('2048')).toBe(2048);
		expect(bodyLimitBytes(' 3m ')).toBe(3 * 1024 * 1024);
	});

	it('un valor que no es un tamaño devuelve NaN', () => {
		expect(bodyLimitBytes('diez megas')).toBeNaN();
		expect(bodyLimitBytes('')).toBeNaN();
		expect(bodyLimitBytes('10MB')).toBeNaN();
	});
});
