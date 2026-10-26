// Filtros de las listas del panel (UX-09, BE-FR-49.8; T251): fechas en `dd/mm/aaaa` o ISO con `desde ≤ hasta`, página entera
// ≥ 1 sin coerción implícita, periodo cerrado en 30 o 90 días y app opcional.
import { describe, expect, it } from 'vitest';
import { parsePanelFilters, queryOfFilters } from './filters';

describe('parsePanelFilters', () => {
	it('acepta fechas en dd/mm/aaaa y en ISO y las devuelve como fecha de calendario', () => {
		expect(parsePanelFilters({ desde: '01/10/2026', hasta: '2026-10-31' })).toEqual({
			ok: true,
			value: {
				desde: '2026-10-01',
				hasta: '2026-10-31',
				app: null,
				pagina: 1,
				periodo: null,
				orden: 'desc'
			}
		});
	});

	it('[UX-09] el orden por fecha es «desc» por defecto y solo admite «asc» o «desc»', () => {
		expect(parsePanelFilters({ orden: 'asc' })).toMatchObject({
			ok: true,
			value: { orden: 'asc' }
		});
		expect(parsePanelFilters({ orden: 'desc' })).toMatchObject({
			ok: true,
			value: { orden: 'desc' }
		});
		expect(parsePanelFilters({ orden: 'fecha' })).toEqual({
			ok: false,
			errors: { orden: 'validation_invalid' }
		});
	});

	it('rechaza un rango con desde posterior a hasta', () => {
		expect(parsePanelFilters({ desde: '02/10/2026', hasta: '01/10/2026' })).toEqual({
			ok: false,
			errors: { hasta: 'validation_invalid' }
		});
	});

	it('rechaza fechas que no existen', () => {
		expect(parsePanelFilters({ desde: '31/02/2026' })).toEqual({
			ok: false,
			errors: { desde: 'validation_invalid' }
		});
	});

	it('la página son dígitos y empieza en 1; cualquier otra cosa se rechaza', () => {
		expect(parsePanelFilters({ pagina: '3' })).toMatchObject({ ok: true, value: { pagina: 3 } });
		expect(parsePanelFilters({ pagina: '0' })).toEqual({
			ok: false,
			errors: { pagina: 'validation_invalid' }
		});
		expect(parsePanelFilters({ pagina: '2x' })).toEqual({
			ok: false,
			errors: { pagina: 'validation_invalid' }
		});
		expect(parsePanelFilters({ pagina: ' 2' })).toEqual({
			ok: false,
			errors: { pagina: 'validation_invalid' }
		});
	});

	it('el periodo solo puede ser 30 o 90 días', () => {
		expect(parsePanelFilters({ periodo: '90' })).toMatchObject({
			ok: true,
			value: { periodo: 90 }
		});
		expect(parsePanelFilters({ periodo: '60' })).toEqual({
			ok: false,
			errors: { periodo: 'validation_invalid' }
		});
	});

	it('la app es opcional y vacía equivale a ninguna', () => {
		expect(parsePanelFilters({ app: 'secretario' })).toMatchObject({
			ok: true,
			value: { app: 'secretario' }
		});
		expect(parsePanelFilters({ app: '' })).toMatchObject({ ok: true, value: { app: null } });
	});
});

describe('queryOfFilters', () => {
	it('conserva los filtros en la query y la página solo si pasa de la primera', () => {
		const parsed = parsePanelFilters({ desde: '01/10/2026', app: 'secretario' });
		if (!parsed.ok) throw new Error('los filtros de prueba deben ser válidos');

		expect(queryOfFilters(parsed.value, 2)).toBe('?desde=01%2F10%2F2026&app=secretario&pagina=2');
		expect(queryOfFilters(parsed.value, 1)).toBe('?desde=01%2F10%2F2026&app=secretario');
		const ascending = parsePanelFilters({ orden: 'asc' });
		if (!ascending.ok) throw new Error('el orden de prueba debe ser válido');
		expect(queryOfFilters(ascending.value, null)).toBe('?orden=asc');
		const empty = parsePanelFilters({});
		if (!empty.ok) throw new Error('sin filtros debe ser válido');
		expect(queryOfFilters(empty.value, null)).toBe('');
	});
});
