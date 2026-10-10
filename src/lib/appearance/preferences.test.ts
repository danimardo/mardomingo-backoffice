import { describe, expect, it } from 'vitest';
import {
	appearanceAttributes,
	appearanceFromCookies,
	DEFAULT_APPEARANCE,
	safeInternalPath
} from './preferences';

function jar(values: Readonly<Record<string, string>>): (name: string) => string | undefined {
	return (name) => values[name];
}

describe('appearanceFromCookies', () => {
	it('sin cookies, sistema y normal', () => {
		expect(appearanceFromCookies(jar({}))).toEqual(DEFAULT_APPEARANCE);
	});

	it('lee tema claro u oscuro y efectos reducidos', () => {
		expect(appearanceFromCookies(jar({ mdm_theme: 'dark', mdm_effects: 'reduced' }))).toEqual({
			theme: 'dark',
			effects: 'reduced'
		});
	});

	it('un valor inválido se ignora', () => {
		expect(appearanceFromCookies(jar({ mdm_theme: 'verde', mdm_effects: 'algo' }))).toEqual(
			DEFAULT_APPEARANCE
		);
	});
});

describe('appearanceAttributes', () => {
	it('sistema y normal no añaden atributos', () => {
		expect(appearanceAttributes(DEFAULT_APPEARANCE)).toBe('');
	});

	it('pinta data-theme y data-effects solo cuando hay preferencia', () => {
		expect(appearanceAttributes({ theme: 'light', effects: 'reduced' })).toBe(
			'data-theme="light" data-effects="reduced"'
		);
	});
});

describe('safeInternalPath', () => {
	it('deja pasar rutas internas con su query', () => {
		expect(safeInternalPath('/panel/movimientos?pagina=2')).toBe('/panel/movimientos?pagina=2');
	});

	it('cualquier otra cosa vuelve al inicio', () => {
		expect(safeInternalPath('https://evil.example')).toBe('/');
		expect(safeInternalPath('//evil.example')).toBe('/');
		expect(safeInternalPath('/\\evil.example')).toBe('/');
		expect(safeInternalPath('panel')).toBe('/');
		expect(safeInternalPath(null)).toBe('/');
		expect(safeInternalPath(undefined)).toBe('/');
	});
});
