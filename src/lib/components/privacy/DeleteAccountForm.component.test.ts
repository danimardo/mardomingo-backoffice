// Formulario de borrado de cuenta (W29; BE-FR-07; UX-07; T286): foco inicial fuera de «Borrar mi cuenta», casilla nunca
// premarcada y con su error asociado, lo que se pierde en créditos y en euros, las apps afectadas y la advertencia de que
// afecta a todas y no hay reembolso.
import { render, screen, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import DeleteAccountForm from './DeleteAccountForm.svelte';

const BASE = {
	lossMicro: 25_000_000,
	lossEurCents: 500,
	apps: ['Otra app', 'Secretario AI'],
	errors: {},
	formError: '',
	profileHref: '/panel/perfil'
};

describe('DeleteAccountForm', () => {
	it('avisa de que afecta a todas las aplicaciones y de que el saldo se pierde sin reembolso', () => {
		render(DeleteAccountForm, { props: BASE });

		expect(screen.getByText(/todas las aplicaciones de Mardomingo/)).toBeInTheDocument();
		const loss = screen.getByText(/Perderás/);
		expect(loss).toHaveTextContent(/25 créditos/);
		expect(loss).toHaveTextContent(/5,00/);
		expect(loss).toHaveTextContent(/sin reembolso/);
	});

	it('sin saldo lo dice y no habla de pérdida', () => {
		render(DeleteAccountForm, { props: { ...BASE, lossMicro: 0, lossEurCents: 0 } });

		expect(screen.getByText('No tienes créditos que perder.')).toBeInTheDocument();
		expect(screen.queryByText(/Perderás/)).not.toBeInTheDocument();
	});

	it('si no hay equivalencia en euros, no inventa una cifra', () => {
		render(DeleteAccountForm, { props: { ...BASE, lossEurCents: null } });

		expect(screen.getByText(/Perderás/)).toHaveTextContent(/unos —/);
	});

	it('lista las aplicaciones afectadas, o dice que no ha usado ninguna', () => {
		const { unmount } = render(DeleteAccountForm, { props: BASE });
		const list = screen.getByRole('list');
		expect(
			within(list)
				.getAllByRole('listitem')
				.map((item) => item.textContent)
		).toEqual(['Otra app', 'Secretario AI']);
		unmount();

		render(DeleteAccountForm, { props: { ...BASE, apps: [] } });
		expect(screen.getByText('Todavía no has usado ninguna aplicación.')).toBeInTheDocument();
	});

	it('el foco inicial no está en «Borrar mi cuenta» y la casilla no viene marcada', () => {
		render(DeleteAccountForm, { props: BASE });

		expect(screen.getByRole('button', { name: 'Borrar mi cuenta' })).not.toHaveFocus();
		expect(document.body).toHaveFocus();
		expect(screen.getByRole('checkbox')).not.toBeChecked();
	});

	it('pide la contraseña con su autocompletado y envía a la acción de borrar', () => {
		const { container } = render(DeleteAccountForm, { props: BASE });

		expect(screen.getByLabelText('Tu contraseña, para confirmar')).toHaveAttribute(
			'autocomplete',
			'current-password'
		);
		const form = container.querySelector('form');
		expect(form).toHaveAttribute('method', 'POST');
		expect(form).toHaveAttribute('action', '?/borrarCuenta');
	});

	it('el error de la casilla va asociado al campo y el resumen enlaza con él', () => {
		render(DeleteAccountForm, {
			props: { ...BASE, errors: { confirmLoss: 'Revisa este campo.' } }
		});

		const checkbox = screen.getByRole('checkbox');
		expect(checkbox).toHaveAttribute('aria-invalid', 'true');
		expect(checkbox).toHaveAccessibleDescription('Revisa este campo.');
		const summary = screen.getByRole('alert');
		expect(within(summary).getByRole('link', { name: 'Revisa este campo.' })).toHaveAttribute(
			'href',
			'#confirmLoss'
		);
	});

	it('una contraseña errónea se muestra como error del formulario', () => {
		render(DeleteAccountForm, {
			props: { ...BASE, formError: 'La contraseña no es correcta.' }
		});

		expect(screen.getByRole('alert')).toHaveTextContent('La contraseña no es correcta.');
	});

	it('ofrece volver al perfil sin borrar', () => {
		render(DeleteAccountForm, { props: BASE });

		expect(screen.getByRole('link', { name: 'No borrar y volver a mi perfil' })).toHaveAttribute(
			'href',
			'/panel/perfil'
		);
	});
});
