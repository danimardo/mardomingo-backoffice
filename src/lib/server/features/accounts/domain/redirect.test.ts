import { describe, expect, it } from 'vitest';
import { REDIRECT_MAX_LENGTH, safeRedirect } from './redirect';

describe('safeRedirect (contracts/web-routes.md 1.2)', () => {
	it('acepta rutas internas relativas, con su query', () => {
		expect(safeRedirect('/panel/perfil')).toBe('/panel/perfil');
		expect(safeRedirect('/panel/movimientos?desde=2026-10-01')).toBe(
			'/panel/movimientos?desde=2026-10-01'
		);
	});

	it('sustituye por /panel lo que no es una ruta interna', () => {
		expect(safeRedirect('https://evil.example')).toBe('/panel');
		expect(safeRedirect('//evil.example')).toBe('/panel');
		expect(safeRedirect('/\\evil.example')).toBe('/panel');
		expect(safeRedirect('panel')).toBe('/panel');
		expect(safeRedirect('/con espacio')).toBe('/panel');
	});

	it('sin valor o con cadena vacía usa /panel', () => {
		expect(safeRedirect(undefined)).toBe('/panel');
		expect(safeRedirect(null)).toBe('/panel');
		expect(safeRedirect('')).toBe('/panel');
	});

	it('limita la longitud a 2048 caracteres', () => {
		expect(safeRedirect(`/${'a'.repeat(REDIRECT_MAX_LENGTH - 1)}`)).toHaveLength(
			REDIRECT_MAX_LENGTH
		);
		expect(safeRedirect(`/${'a'.repeat(REDIRECT_MAX_LENGTH)}`)).toBe('/panel');
	});
});
