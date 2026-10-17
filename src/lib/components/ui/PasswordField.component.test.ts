import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import PasswordField from './PasswordField.svelte';

describe('PasswordField', () => {
	it('el campo es de contraseña y su botón dice el estado con aria-pressed', async () => {
		render(PasswordField, {
			props: { id: 'password', name: 'password', label: 'Contraseña', autocomplete: 'new-password' }
		});

		const input = screen.getByLabelText('Contraseña');
		expect(input.getAttribute('type')).toBe('password');
		const toggle = screen.getByRole('button', { name: 'Mostrar' });
		expect(toggle.getAttribute('aria-pressed')).toBe('false');

		await fireEvent.click(toggle);

		expect(input.getAttribute('type')).toBe('text');
		expect(screen.getByRole('button', { name: 'Ocultar' }).getAttribute('aria-pressed')).toBe(
			'true'
		);
	});

	it('la regla de longitud se muestra antes de escribir, enlazada al campo', () => {
		render(PasswordField, {
			props: {
				id: 'password',
				name: 'password',
				label: 'Contraseña',
				autocomplete: 'new-password',
				hint: 'Entre 8 y 128 caracteres.'
			}
		});

		const input = screen.getByLabelText('Contraseña');
		expect(input.getAttribute('aria-describedby')).toBe('password-hint');
		expect(screen.getByText('Entre 8 y 128 caracteres.')).toBeTruthy();
	});
});
