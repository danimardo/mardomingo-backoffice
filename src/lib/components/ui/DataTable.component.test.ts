// Tabla de datos (DS-06, UX-09; T257): encabezados con alcance de columna, orden marcado y enlazado por GET, y nombre accesible.
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import DataTable from './DataTable.svelte';

const columns = [
	{ key: 'date', label: 'Fecha', sortHref: '?orden=fecha', sort: 'ascending' as const },
	{ key: 'credits', label: 'Créditos', align: 'end' as const }
];

describe('DataTable', () => {
	it('los encabezados son de columna y el orden actual se anuncia', () => {
		render(DataTable, {
			props: { caption: 'Movimientos', columns, rows: [['11/10/2026', '10,5']] }
		});

		const date = screen.getByRole('columnheader', { name: 'Fecha' });
		expect(date.getAttribute('scope')).toBe('col');
		expect(date.getAttribute('aria-sort')).toBe('ascending');
		expect(screen.getByRole('link', { name: 'Fecha' }).getAttribute('href')).toBe('?orden=fecha');
	});

	it('la tabla tiene su título accesible y la región con nombre es enfocable', () => {
		const { container } = render(DataTable, {
			props: { caption: 'Movimientos', columns, rows: [] }
		});

		expect(screen.getByRole('table', { name: 'Movimientos' })).toBeTruthy();
		expect(container.querySelector('.scroll')?.getAttribute('tabindex')).toBe('0');
	});

	it('las cifras de la columna numérica van alineadas al final', () => {
		render(DataTable, {
			props: { caption: 'Movimientos', columns, rows: [['11/10/2026', '10,5']] }
		});

		expect(screen.getByRole('cell', { name: '10,5' }).classList.contains('num')).toBe(true);
	});
});
