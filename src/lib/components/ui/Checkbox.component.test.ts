import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import Checkbox from './Checkbox.svelte';

function label(text: string) {
	return createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));
}

describe('Checkbox', () => {
	it('sale sin marcar, sin obligatoriedad y sin error, con el texto como etiqueta', () => {
		render(Checkbox, {
			props: { id: 'acepto', name: 'acceptTerms', children: label('Acepto los términos') }
		});

		const box = screen.getByRole('checkbox', { name: 'Acepto los términos' });
		expect(box).toHaveProperty('checked', false);
		expect(box.hasAttribute('required')).toBe(false);
		expect(box.getAttribute('aria-invalid')).toBeNull();
		expect(box.getAttribute('aria-describedby')).toBeNull();
		expect(document.getElementById('acepto-error')).toBeNull();
	});

	it('con error, lo enlaza por aria-describedby y marca el campo como inválido', () => {
		render(Checkbox, {
			props: {
				id: 'acepto',
				name: 'acceptTerms',
				required: true,
				error: 'Debes aceptarlo para continuar.',
				children: label('Acepto')
			}
		});

		const box = screen.getByRole('checkbox', { name: 'Acepto' });
		expect(box.hasAttribute('required')).toBe(true);
		expect(box.getAttribute('aria-invalid')).toBe('true');
		expect(box.getAttribute('aria-describedby')).toBe('acepto-error');
		expect(document.getElementById('acepto-error')?.textContent).toBe(
			'Debes aceptarlo para continuar.'
		);
	});
});
