import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoginForm from './LoginForm.svelte';

function formIn(container: HTMLElement): HTMLFormElement {
	const form = container.querySelector('form');
	if (form === null) throw new Error('El formulario no está en pantalla.');
	return form;
}

// `use:enhance` llama a fetch después de una microtarea: esperar un turno de la cola de eventos lo deja hecho.
async function settle(): Promise<void> {
	await new Promise<void>((resolve) => {
		setTimeout(resolve, 0);
	});
}

describe('LoginForm', () => {
	// `use:enhance` pide la acción con fetch. Una respuesta que nunca llega deja el envío en curso.
	const request = vi.fn(() => new Promise<Response>(() => {}));

	beforeEach(() => {
		request.mockClear();
		vi.stubGlobal('fetch', request);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('muestra el email y la contraseña con sus etiquetas, y el botón Entrar', () => {
		const { container } = render(LoginForm, {
			props: { errors: {}, formError: '', redirectTo: '/panel' }
		});

		expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAttribute('type', 'email');
		expect(screen.getByLabelText('Contraseña', { exact: true })).toHaveAttribute(
			'autocomplete',
			'current-password'
		);
		expect(container.querySelector('input[name="redirectTo"]')).toHaveValue('/panel');
		expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
	});

	it('el botón tiene aria-busy mientras envía, y un segundo envío no sale', async () => {
		const { container } = render(LoginForm, {
			props: { errors: {}, formError: '', redirectTo: '/panel' }
		});
		await fireEvent.input(screen.getByRole('textbox', { name: 'Email' }), {
			target: { value: 'nadie@ejemplo.es' }
		});
		await fireEvent.input(screen.getByLabelText('Contraseña', { exact: true }), {
			target: { value: 'mal-escrita' }
		});
		const submit = screen.getByRole('button', { name: 'Entrar' });
		expect(submit).not.toHaveAttribute('aria-busy');

		await fireEvent.click(submit);

		const busy = screen.getByRole('button', { name: 'Enviando…' });
		expect(busy).toHaveAttribute('aria-busy', 'true');
		await vi.waitFor(() => {
			expect(request).toHaveBeenCalledTimes(1);
		});

		await fireEvent.click(busy);
		await fireEvent.submit(formIn(container));
		await settle();

		expect(request).toHaveBeenCalledTimes(1);
	});

	it('el error de la contraseña se muestra en el resumen y en el campo', () => {
		render(LoginForm, {
			props: {
				errors: { password: 'Email o contraseña no válidos.' },
				formError: '',
				redirectTo: '/panel'
			}
		});

		expect(screen.getByRole('link', { name: 'Email o contraseña no válidos.' })).toHaveAttribute(
			'href',
			'#password'
		);
		expect(screen.getByLabelText('Contraseña', { exact: true })).toHaveAttribute(
			'aria-invalid',
			'true'
		);
	});
});
