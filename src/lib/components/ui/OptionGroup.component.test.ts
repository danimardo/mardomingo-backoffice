// Grupo de opciones nativo (DS-06, T362): un fieldset con su leyenda y radios reales, con la opción de `value` marcada.
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import OptionGroup from './OptionGroup.svelte';

const options = [
	{ value: 'asc', label: 'Ascendente' },
	{ value: 'desc', label: 'Descendente' }
];

describe('OptionGroup', () => {
	it('agrupa las opciones en un fieldset con su leyenda', () => {
		const { container } = render(OptionGroup, {
			props: { name: 'orden', legend: 'Orden', options }
		});

		expect(container.querySelector('fieldset')).not.toBeNull();
		expect(screen.getByRole('group', { name: 'Orden' })).toBeTruthy();
	});

	it('usa radios reales, todos con el mismo nombre', () => {
		const { container } = render(OptionGroup, {
			props: { name: 'orden', legend: 'Orden', options }
		});

		const radios = container.querySelectorAll('input[type="radio"]');
		expect(radios.length).toBe(2);
		for (const radio of radios) expect(radio.getAttribute('name')).toBe('orden');
	});

	it('marca solo la opción de value y ninguna si no hay valor', () => {
		const { container, unmount } = render(OptionGroup, {
			props: { name: 'orden', legend: 'Orden', options, value: 'desc' }
		});

		const checked = container.querySelectorAll('input[type="radio"]:checked');
		expect(checked.length).toBe(1);
		expect(checked[0]?.getAttribute('value')).toBe('desc');
		unmount();

		const empty = render(OptionGroup, { props: { name: 'orden', legend: 'Orden', options } });
		expect(empty.container.querySelectorAll('input[type="radio"]:checked').length).toBe(0);
	});
});
