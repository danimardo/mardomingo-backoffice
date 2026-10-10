import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import TextField from './TextField.svelte';

describe('TextField', () => {
	it('asocia la etiqueta visible al campo', () => {
		render(TextField, {
			props: { id: 'email', name: 'email', label: 'Correo electrónico', type: 'email' }
		});

		const input = screen.getByLabelText('Correo electrónico');
		expect(input.getAttribute('id')).toBe('email');
		expect(input.getAttribute('type')).toBe('email');
	});

	it('el error se enlaza con aria-describedby y marca aria-invalid', () => {
		render(TextField, {
			props: { id: 'email', name: 'email', label: 'Correo', error: 'Revisa este campo.' }
		});

		const input = screen.getByLabelText('Correo');
		expect(input.getAttribute('aria-invalid')).toBe('true');
		const describedBy = input.getAttribute('aria-describedby');
		expect(describedBy).toBe('email-error');
		expect(document.getElementById(String(describedBy))?.textContent).toContain(
			'Revisa este campo.'
		);
	});

	it('sin error, la ayuda se enlaza y no hay aria-invalid', () => {
		render(TextField, {
			props: { id: 'nombre', name: 'nombre', label: 'Nombre', hint: 'Como aparece en tus facturas' }
		});

		const input = screen.getByLabelText('Nombre');
		expect(input.getAttribute('aria-invalid')).toBeNull();
		expect(input.getAttribute('aria-describedby')).toBe('nombre-hint');
	});

	it('pasa el autocompletado al navegador', () => {
		render(TextField, {
			props: {
				id: 'pass',
				name: 'password',
				label: 'Contraseña',
				type: 'password',
				autocomplete: 'current-password'
			}
		});

		expect(screen.getByLabelText('Contraseña').getAttribute('autocomplete')).toBe(
			'current-password'
		);
	});
});
