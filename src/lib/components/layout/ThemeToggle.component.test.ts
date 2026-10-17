import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import ThemeToggle from './ThemeToggle.svelte';

describe('ThemeToggle', () => {
	it('agrupa las tres opciones con un nombre accesible', () => {
		render(ThemeToggle, { props: { current: 'system', redirectTo: '/preferencias' } });

		const group = screen.getByRole('group', { name: 'Tema' });
		expect(group).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Sistema' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Claro' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Oscuro' })).toBeTruthy();
	});

	it('marca la opción actual con aria-pressed', () => {
		render(ThemeToggle, { props: { current: 'dark', redirectTo: '/' } });

		expect(screen.getByRole('button', { name: 'Oscuro' }).getAttribute('aria-pressed')).toBe(
			'true'
		);
		expect(screen.getByRole('button', { name: 'Claro' }).getAttribute('aria-pressed')).toBe(
			'false'
		);
	});

	it('envía a la acción de tema y conserva la página de retorno', () => {
		const { container } = render(ThemeToggle, {
			props: { current: 'light', redirectTo: '/panel?x=1' }
		});

		const form = container.querySelector('form');
		expect(form?.getAttribute('action')).toBe('/preferencias?/tema');
		const hidden = container.querySelector('input[name="redirectTo"]');
		expect(hidden?.getAttribute('value')).toBe('/panel?x=1');
	});
});
