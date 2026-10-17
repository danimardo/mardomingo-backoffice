// Lista desplegable nativa (DS-06; T302): etiqueta asociada, opciones y error con texto enlazado.
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Select from './Select.svelte';

const OPTIONS = [
	{ value: 'bloqueo', label: 'Bloqueo' },
	{ value: 'tester', label: 'Tester' }
];

describe('Select', () => {
	it('es un select nativo con su etiqueta y sus opciones', () => {
		render(Select, { props: { id: 'accion', name: 'accion', label: 'Acción', options: OPTIONS } });

		const select = screen.getByRole('combobox', { name: 'Acción' });
		expect(select.tagName).toBe('SELECT');
		expect(screen.getByRole('option', { name: 'Bloqueo' })).toBeInTheDocument();
	});

	it('el valor inicial es el que llega', () => {
		render(Select, {
			props: { id: 'accion', name: 'accion', label: 'Acción', options: OPTIONS, value: 'tester' }
		});

		expect(screen.getByRole('combobox', { name: 'Acción' })).toHaveValue('tester');
	});

	it('el error va enlazado al campo y se anuncia con texto', () => {
		render(Select, {
			props: {
				id: 'accion',
				name: 'accion',
				label: 'Acción',
				options: OPTIONS,
				error: 'Elige una acción.'
			}
		});

		const select = screen.getByRole('combobox', { name: 'Acción' });
		expect(select).toHaveAttribute('aria-invalid', 'true');
		expect(select).toHaveAccessibleDescription('Elige una acción.');
	});
});
