// Paginación (DS-06, UX-09; T257): página actual con `aria-current` y el resto de enlaces conservan el filtro del `hrefFor`.
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Pagination from './Pagination.svelte';

describe('Pagination', () => {
	it('marca la página actual y compone cada enlace con el filtro', () => {
		render(Pagination, {
			props: { current: 2, total: 3, hrefFor: (page: number) => `?pagina=${String(page)}&app=sec` }
		});

		expect(screen.getByRole('link', { name: 'Página 2' }).getAttribute('aria-current')).toBe(
			'page'
		);
		expect(screen.getByRole('link', { name: 'Página 1' }).getAttribute('aria-current')).toBeNull();
		expect(screen.getByRole('link', { name: 'Siguiente' }).getAttribute('href')).toBe(
			'?pagina=3&app=sec'
		);
	});

	it('sin más de una página no se muestra nada', () => {
		const { container } = render(Pagination, {
			props: { current: 1, total: 1, hrefFor: (page: number) => `?pagina=${String(page)}` }
		});

		expect(container.querySelector('nav')).toBeNull();
	});
});
