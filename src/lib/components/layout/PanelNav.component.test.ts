// Navegación de administración (T300; 16.5): el enlace de la página actual lleva `aria-current="page"`, cada enlace tiene nombre
// accesible y es un `<a href>` que se alcanza con el teclado.
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import PanelNav from './PanelNav.svelte';

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/admin/usuarios') } }));

const links = [
	{ href: '/admin', label: 'Inicio' },
	{ href: '/admin/usuarios', label: 'Usuarios' },
	{ href: '/admin/legal', label: 'Legal' }
];

describe('PanelNav (administración)', () => {
	it('marca solo la página actual con aria-current="page"', () => {
		render(PanelNav, { props: { links, label: 'Navegación de administración' } });

		expect(screen.getByRole('link', { name: 'Usuarios' })).toHaveAttribute('aria-current', 'page');
		expect(screen.getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current');
		expect(screen.getByRole('link', { name: 'Legal' })).not.toHaveAttribute('aria-current');
	});

	it('la navegación tiene nombre y cada enlace es un <a href> alcanzable con el teclado', () => {
		render(PanelNav, { props: { links, label: 'Navegación de administración' } });

		expect(
			screen.getByRole('navigation', { name: 'Navegación de administración' })
		).toBeInTheDocument();
		for (const link of screen.getAllByRole('link')) {
			expect(link.tagName).toBe('A');
			expect(link).toHaveAttribute('href');
		}
	});
});
