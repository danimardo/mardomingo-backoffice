import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import Button from './Button.svelte';

function label(text: string) {
	return createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));
}

describe('Button', () => {
	it('es un botón de formulario con nombre y valor', () => {
		render(Button, {
			props: { type: 'submit', name: 'theme', value: 'dark', children: label('Oscuro') }
		});

		const button = screen.getByRole('button', { name: 'Oscuro' });
		expect(button.getAttribute('type')).toBe('submit');
		expect(button.getAttribute('name')).toBe('theme');
		expect(button.getAttribute('value')).toBe('dark');
	});

	it('con href es un enlace y no un botón', () => {
		render(Button, { props: { href: '/preferencias', children: label('Preferencias') } });

		expect(screen.getByRole('link', { name: 'Preferencias' }).getAttribute('href')).toBe(
			'/preferencias'
		);
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('marca aria-busy mientras se envía', () => {
		render(Button, { props: { type: 'submit', busy: true, children: label('Guardar') } });

		expect(screen.getByRole('button', { name: 'Guardar' }).getAttribute('aria-busy')).toBe('true');
	});

	it('deshabilitado no se puede pulsar', () => {
		render(Button, { props: { disabled: true, children: label('Guardar') } });

		expect(screen.getByRole('button', { name: 'Guardar' }).hasAttribute('disabled')).toBe(true);
	});

	it('la opción actual de un grupo se anuncia con aria-pressed', () => {
		render(Button, { props: { pressed: true, children: label('Claro') } });

		expect(screen.getByRole('button', { name: 'Claro' }).getAttribute('aria-pressed')).toBe('true');
	});
});
