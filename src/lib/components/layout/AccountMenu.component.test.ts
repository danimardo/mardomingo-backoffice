// Menú de cuenta (DS-06, T362; T361): sin sesión, enlaces de entrada y registro; con sesión, un `<details>` nativo con el
// panel, «Salir» y «Administración» solo para administradores.
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import AccountMenu from './AccountMenu.svelte';

describe('AccountMenu', () => {
	it('sin sesión muestra la entrada y el registro, sin menú', () => {
		const { container } = render(AccountMenu, { props: { signedIn: false, isAdmin: false } });

		expect(container.querySelector('details')).toBeNull();
		expect(container.querySelector('a[href="/login"]')).not.toBeNull();
		expect(container.querySelector('a[href="/registro"]')).not.toBeNull();
	});

	it('con sesión usa un details nativo con el panel y la salida', () => {
		const { container } = render(AccountMenu, { props: { signedIn: true, isAdmin: false } });

		expect(container.querySelector('details.menu summary')).not.toBeNull();
		expect(container.querySelector('a[href="/panel"]')).not.toBeNull();
		expect(container.querySelector('a[href="/logout"]')).not.toBeNull();
	});

	it('el enlace de administración solo aparece para administradores', () => {
		const user = render(AccountMenu, { props: { signedIn: true, isAdmin: false } });
		expect(user.container.querySelector('a[href="/admin"]')).toBeNull();
		user.unmount();

		const admin = render(AccountMenu, { props: { signedIn: true, isAdmin: true } });
		expect(admin.container.querySelector('a[href="/admin"]')).not.toBeNull();
	});
});
