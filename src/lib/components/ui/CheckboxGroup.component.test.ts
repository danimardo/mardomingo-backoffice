// Grupo de casillas (DS-06; T302): fieldset con legend, ninguna casilla premarcada y cada casilla con su etiqueta.
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import CheckboxGroup from './CheckboxGroup.svelte';

const OPTIONS = [
	{ value: 'replacements', label: 'Reemplazos' },
	{ value: 'prompts', label: 'Prompts' }
];

describe('CheckboxGroup', () => {
	it('es un fieldset con su legend y una casilla por opción', () => {
		render(CheckboxGroup, {
			props: { id: 'cats', name: 'categorias', legend: 'Categorías', options: OPTIONS }
		});

		expect(screen.getByRole('group', { name: 'Categorías' })).toBeInTheDocument();
		expect(screen.getByRole('checkbox', { name: 'Reemplazos' })).toBeInTheDocument();
		expect(screen.getByRole('checkbox', { name: 'Prompts' })).toBeInTheDocument();
	});

	it('ninguna casilla viene marcada si el llamador no la marca', () => {
		render(CheckboxGroup, {
			props: { id: 'cats', name: 'categorias', legend: 'Categorías', options: OPTIONS }
		});

		for (const box of screen.getAllByRole('checkbox')) expect(box).not.toBeChecked();
	});

	it('marca solo las opciones que llegan como seleccionadas', () => {
		render(CheckboxGroup, {
			props: {
				id: 'cats',
				name: 'categorias',
				legend: 'Categorías',
				options: OPTIONS,
				selected: ['prompts']
			}
		});

		expect(screen.getByRole('checkbox', { name: 'Prompts' })).toBeChecked();
		expect(screen.getByRole('checkbox', { name: 'Reemplazos' })).not.toBeChecked();
	});

	it('el error se anuncia con texto y el grupo lo describe', () => {
		render(CheckboxGroup, {
			props: {
				id: 'cats',
				name: 'categorias',
				legend: 'Categorías',
				options: OPTIONS,
				error: 'Elige al menos una.'
			}
		});

		expect(screen.getByRole('group', { name: 'Categorías' })).toHaveAccessibleDescription(
			'Elige al menos una.'
		);
	});
});
