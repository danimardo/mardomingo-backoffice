// «Próximamente» de la compra (UX-06; T245): texto visible y enfocable, no solo un botón desactivado.
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import ComingSoonNotice from './ComingSoonNotice.svelte';

describe('ComingSoonNotice', () => {
	it('explica que la compra no está disponible, con un título visible', () => {
		render(ComingSoonNotice);

		expect(screen.getByRole('heading', { name: 'Próximamente' })).toBeTruthy();
		expect(screen.getByText(/todavía no está disponible/)).toBeTruthy();
	});

	it('el contenedor es enfocable por teclado (tabindex -1, enfocable por script)', () => {
		const { container } = render(ComingSoonNotice);

		expect(container.querySelector('.coming-soon')?.getAttribute('tabindex')).toBe('-1');
	});
});
