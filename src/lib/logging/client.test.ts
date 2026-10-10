import { describe, expect, it } from 'vitest';
import { describeError, fingerprintOf, framesOf } from './client';

describe('describeError', () => {
	it('nunca devuelve el mensaje del error', () => {
		const error = new TypeError('el usuario ana@example.com no existe');

		const { name, frames } = describeError(error);

		expect(name).toBe('TypeError');
		expect(JSON.stringify({ name, frames })).not.toContain('ana@example.com');
	});

	it('un valor que no es Error se describe sin datos', () => {
		expect(describeError('texto libre con secreto')).toEqual({ name: 'NonError', frames: [] });
	});
});

describe('framesOf', () => {
	it('conserva solo las líneas de pila y quita la query de las URL del bundle', () => {
		const stack = [
			'Error: fallo',
			'    at render (https://cuenta.mardomingo.com/_app/chunk.js?v=abc123:10:5)',
			'    at load'
		].join('\n');

		expect(framesOf(stack)).toEqual([
			'at render (https://cuenta.mardomingo.com/_app/chunk.js:10:5)',
			'at load'
		]);
	});

	it('acota el número de líneas', () => {
		const stack = Array.from({ length: 50 }, (_, index) => `    at f${String(index)}`).join('\n');

		expect(framesOf(stack)).toHaveLength(20);
	});

	it('sin pila no hay líneas', () => {
		expect(framesOf(undefined)).toEqual([]);
	});
});

describe('fingerprintOf', () => {
	it('es estable y tiene 8 dígitos hexadecimales', () => {
		const first = fingerprintOf('TypeError', ['at render (a.js:1:1)']);

		expect(fingerprintOf('TypeError', ['at render (a.js:1:1)'])).toBe(first);
		expect(first).toMatch(/^[0-9a-f]{8}$/);
	});

	it('cambia cuando cambia la primera línea de la pila', () => {
		expect(fingerprintOf('TypeError', ['at a'])).not.toBe(fingerprintOf('TypeError', ['at b']));
	});
});
