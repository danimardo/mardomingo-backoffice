// Comparación de versiones `x.y.z` y rangos inclusivos (BE-FR-48 CA1, BE-FR-85 CA1; T189). Puro.
import { describe, expect, it } from 'vitest';
import { compareVersions, inRange, parseVersion } from './semver';

describe('parseVersion', () => {
	it('lee x.y.z numéricos', () => {
		expect(parseVersion('4.12.0')).toEqual({ major: 4, minor: 12, patch: 0 });
	});

	it('una versión ausente o inválida no se interpreta', () => {
		expect(parseVersion(null)).toBeNull();
		expect(parseVersion('')).toBeNull();
		expect(parseVersion('4.0')).toBeNull();
		expect(parseVersion('4.0.0-beta')).toBeNull();
		expect(parseVersion('v4.0.0')).toBeNull();
		expect(parseVersion('4.x.0')).toBeNull();
	});
});

describe('compareVersions', () => {
	it('compara por mayor, menor y parche, en ese orden', () => {
		expect(compareVersions('4.0.0', '3.9.9')).toBeGreaterThan(0);
		expect(compareVersions('4.1.0', '4.0.9')).toBeGreaterThan(0);
		expect(compareVersions('4.0.10', '4.0.9')).toBeGreaterThan(0);
		expect(compareVersions('4.0.0', '4.0.0')).toBe(0);
		expect(compareVersions('1.0.0', '2.0.0')).toBeLessThan(0);
	});

	it('no compara como texto: 4.10.0 es mayor que 4.9.0', () => {
		expect(compareVersions('4.10.0', '4.9.0')).toBeGreaterThan(0);
	});

	it('una versión inválida no se puede comparar', () => {
		expect(() => compareVersions('4.0', '4.0.0')).toThrow(RangeError);
	});
});

describe('inRange', () => {
	it('los extremos son inclusivos', () => {
		expect(inRange('4.0.0', { min: '4.0.0', max: '4.2.0' })).toBe(true);
		expect(inRange('4.2.0', { min: '4.0.0', max: '4.2.0' })).toBe(true);
		expect(inRange('4.2.1', { min: '4.0.0', max: '4.2.0' })).toBe(false);
		expect(inRange('3.9.9', { min: '4.0.0', max: '4.2.0' })).toBe(false);
	});

	it('un extremo nulo es abierto', () => {
		expect(inRange('1.0.0', { min: null, max: '4.2.0' })).toBe(true);
		expect(inRange('9.0.0', { min: '4.0.0', max: null })).toBe(true);
		expect(inRange('1.0.0', { min: null, max: null })).toBe(true);
	});

	it('sin versión, solo cumple un rango sin extremos (o sin rango)', () => {
		expect(inRange(null, { min: null, max: null })).toBe(true);
		expect(inRange(null, { min: '4.0.0', max: null })).toBe(false);
		expect(inRange('no-es-version', { min: '4.0.0', max: null })).toBe(false);
		expect(inRange('no-es-version', { min: null, max: null })).toBe(true);
	});
});
