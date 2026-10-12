// Contenedor de gráficas (DS-06, UX-08; T256/T257): la tabla equivalente trae los mismos valores que la gráfica, los días sin
// datos se dicen como «Sin datos» (no como cero) y el estado de carga se marca con `aria-busy`.
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import ChartContainer from './ChartContainer.svelte';

const points = [
	{ label: '10/10', value: 12 },
	{ label: '11/10', value: null },
	{ label: '12/10', value: 0 }
];

describe('ChartContainer', () => {
	it('muestra periodo, unidad y vigencia junto al título', () => {
		render(ChartContainer, {
			props: { title: 'Consumo', period: '30 días', unit: 'créditos', validity: 'hoy', points }
		});

		expect(screen.getByRole('heading', { name: 'Consumo' })).toBeTruthy();
		expect(screen.getByText(/Periodo: 30 días · Unidad: créditos · Vigencia: hoy/)).toBeTruthy();
	});

	it('la tabla equivalente trae los mismos valores, y un día sin datos no es cero', () => {
		render(ChartContainer, {
			props: { title: 'Consumo', period: '30 días', unit: 'créditos', validity: 'hoy', points }
		});

		expect(screen.getByRole('table', { name: 'Consumo' })).toBeTruthy();
		expect(screen.getByRole('cell', { name: '12' })).toBeTruthy();
		expect(screen.getByRole('cell', { name: 'Sin datos' })).toBeTruthy();
		expect(screen.getByRole('cell', { name: '0' })).toBeTruthy();
	});

	it('mientras carga, el contenedor se marca como ocupado', () => {
		const { container } = render(ChartContainer, {
			props: {
				title: 'Consumo',
				period: '30 días',
				unit: 'créditos',
				validity: 'hoy',
				points: [],
				busy: true
			}
		});

		expect(container.querySelector('figure')?.getAttribute('aria-busy')).toBe('true');
	});
});
