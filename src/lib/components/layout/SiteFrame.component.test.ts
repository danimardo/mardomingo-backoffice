// Marco del sitio (T044; 16.5, BE-FR-70 CA2): el menú de cuenta según la sesión y el rol, la navegación con la página actual
// marcada, y el pie con los documentos legales y el soporte siempre a un enlace.
import { render, screen, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AccountMenu from './AccountMenu.svelte';
import SiteFooter from './SiteFooter.svelte';
import SiteHeader from './SiteHeader.svelte';

const pathname = vi.hoisted(() => ({ current: '/' }));
vi.mock('$app/state', () => ({
	page: {
		get url() {
			return new URL(`http://localhost${pathname.current}`);
		}
	}
}));

beforeEach(() => {
	pathname.current = '/';
});

describe('AccountMenu', () => {
	it('sin sesión ofrece «Entrar» y «Crear cuenta», y ningún menú', () => {
		render(AccountMenu, { props: { signedIn: false, isAdmin: false } });

		expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login');
		expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute('href', '/registro');
		expect(screen.queryByText('Cuenta')).not.toBeInTheDocument();
	});

	it('con sesión muestra el menú con el panel y «Salir», sin la administración', () => {
		render(AccountMenu, { props: { signedIn: true, isAdmin: false } });

		expect(screen.getByText('Cuenta')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Mi cuenta' })).toHaveAttribute('href', '/panel');
		expect(screen.getByRole('link', { name: 'Salir' })).toHaveAttribute('href', '/logout');
		expect(screen.queryByRole('link', { name: 'Administración' })).not.toBeInTheDocument();
		expect(screen.queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument();
	});

	it('la administración aparece solo para quien pasa su guarda', () => {
		render(AccountMenu, { props: { signedIn: true, isAdmin: true } });

		expect(screen.getByRole('link', { name: 'Administración' })).toHaveAttribute('href', '/admin');
	});

	it('el menú es un <details> con <summary>: se abre con el teclado sin JavaScript', () => {
		const { container } = render(AccountMenu, { props: { signedIn: true, isAdmin: false } });

		const details = container.querySelector('details');
		expect(details).not.toBeNull();
		expect(details?.querySelector('summary')).not.toBeNull();
	});
});

describe('SiteHeader', () => {
	it('tiene la marca y una navegación con nombre accesible', () => {
		render(SiteHeader, { props: {} });

		expect(screen.getByRole('link', { name: 'Cuenta Mardomingo' })).toHaveAttribute('href', '/');
		const nav = screen.getByRole('navigation', { name: 'Navegación principal' });
		expect(within(nav).getByRole('link', { name: 'Precios' })).toHaveAttribute('href', '/precios');
	});

	it('marca solo la página actual con aria-current="page"', () => {
		pathname.current = '/precios';
		render(SiteHeader, { props: {} });

		expect(screen.getByRole('link', { name: 'Precios' })).toHaveAttribute('aria-current', 'page');
	});

	it('en otra página, «Precios» no lleva aria-current', () => {
		render(SiteHeader, { props: { signedIn: true, isAdmin: false } });

		expect(screen.getByRole('link', { name: 'Precios' })).not.toHaveAttribute('aria-current');
	});
});

describe('SiteFooter', () => {
	const props = { redirectTo: '/', theme: 'system', effects: 'normal' } as const;

	it('enlaza a los cuatro documentos legales', () => {
		render(SiteFooter, { props });

		const nav = screen.getByRole('navigation', { name: 'Documentos legales' });
		const hrefs = within(nav)
			.getAllByRole('link')
			.map((link) => link.getAttribute('href'));
		expect(hrefs).toStrictEqual(['/terminos', '/privacidad', '/cookies', '/uso-aceptable']);
	});

	it('muestra el soporte solo si hay correo', () => {
		const { unmount } = render(SiteFooter, { props });
		expect(screen.queryByText(/Soporte:/)).not.toBeInTheDocument();
		unmount();

		render(SiteFooter, { props: { ...props, supportEmail: 'soporte@mardomingo.com' } });
		expect(screen.getByText('Soporte: soporte@mardomingo.com')).toBeInTheDocument();
	});
});
