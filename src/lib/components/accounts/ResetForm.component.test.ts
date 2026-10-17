import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ResetForm from './ResetForm.svelte';

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

describe('ResetForm', () => {
	// `use:enhance` pide la acción con fetch. Una respuesta que nunca llega deja el envío en curso.
	const request = vi.fn(() => new Promise<Response>(() => {}));

	beforeEach(() => {
		request.mockClear();
		vi.stubGlobal('fetch', request);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe('mode="request" (pedir el enlace)', () => {
		it('muestra el email con su etiqueta y el botón Enviar el enlace', () => {
			render(ResetForm, { props: { mode: 'request', errors: {}, formError: '' } });

			expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAttribute('type', 'email');
			expect(screen.queryByLabelText('Nueva contraseña', { exact: true })).toBeNull();
			expect(screen.getByRole('button', { name: 'Enviar el enlace' })).toBeInTheDocument();
		});

		it('el botón tiene aria-busy mientras envía, y un segundo envío no sale', async () => {
			const { container } = render(ResetForm, {
				props: { mode: 'request', errors: {}, formError: '' }
			});
			await fireEvent.input(screen.getByRole('textbox', { name: 'Email' }), {
				target: { value: 'nadie@ejemplo.es' }
			});
			const submit = screen.getByRole('button', { name: 'Enviar el enlace' });
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
	});

	describe('mode="confirm" (fijar la nueva contraseña)', () => {
		const props = {
			mode: 'confirm' as const,
			errors: {},
			formError: '',
			token: 'token-de-un-solo-uso',
			passwordRule: { min: 8, max: 128 }
		};

		it('muestra la nueva contraseña con su etiqueta, la regla visible y el token oculto', () => {
			const { container } = render(ResetForm, { props });

			expect(screen.getByLabelText('Nueva contraseña', { exact: true })).toHaveAttribute(
				'autocomplete',
				'new-password'
			);
			expect(screen.getByText('Entre 8 y 128 caracteres.')).toBeInTheDocument();
			expect(container.querySelector('input[name="token"]')).toHaveValue('token-de-un-solo-uso');
			expect(
				screen.getByRole('button', { name: 'Guardar la nueva contraseña' })
			).toBeInTheDocument();
		});

		it('el botón tiene aria-busy mientras envía, y un segundo envío no sale', async () => {
			const { container } = render(ResetForm, { props });
			await fireEvent.input(screen.getByLabelText('Nueva contraseña', { exact: true }), {
				target: { value: 'contraseña-larga-123' }
			});
			const submit = screen.getByRole('button', { name: 'Guardar la nueva contraseña' });
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
	});
});
