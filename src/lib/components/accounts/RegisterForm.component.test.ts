import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RegisterForm from './RegisterForm.svelte';

const legal = [
	{ kind: 'terms', version: '2026-06', url: '/terminos' },
	{ kind: 'privacy', version: '2026-06', url: '/privacidad' },
	{ kind: 'aup', version: '2026-06', url: '/uso-aceptable' }
];

const base = {
	errors: {},
	formError: '',
	originSlug: null,
	legal,
	minAge: 18,
	passwordRule: { min: 8, max: 128 },
	turnstileSiteKey: ''
};

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

describe('RegisterForm', () => {
	// `use:enhance` pide la acción con fetch. Una respuesta que nunca llega deja el envío en curso.
	const request = vi.fn(() => new Promise<Response>(() => {}));

	beforeEach(() => {
		request.mockClear();
		vi.stubGlobal('fetch', request);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('muestra el email, la contraseña y las casillas legales con sus etiquetas, sin marcar', () => {
		render(RegisterForm, { props: base });

		expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAttribute('type', 'email');
		expect(screen.getByLabelText('Contraseña', { exact: true })).toHaveAttribute(
			'type',
			'password'
		);
		expect(screen.getByText('Entre 8 y 128 caracteres.')).toBeInTheDocument();
		expect(
			screen.getByRole('checkbox', { name: 'Acepto los términos de uso (versión 2026-06).' })
		).not.toBeChecked();
		expect(
			screen.getByRole('checkbox', { name: 'Acepto la política de privacidad (versión 2026-06).' })
		).not.toBeChecked();
		expect(
			screen.getByRole('checkbox', {
				name: 'Acepto la política de uso aceptable (versión 2026-06).'
			})
		).not.toBeChecked();
		expect(
			screen.getByRole('checkbox', { name: 'Declaro tener al menos 18 años.' })
		).not.toBeChecked();
		expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeInTheDocument();
	});

	it('el botón tiene aria-busy mientras envía, y un segundo envío no sale', async () => {
		const { container } = render(RegisterForm, { props: base });
		const submit = screen.getByRole('button', { name: 'Crear cuenta' });
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

	it('los errores de campo y el del negocio se muestran en el resumen, enlazados a su campo', () => {
		render(RegisterForm, {
			props: {
				...base,
				errors: { email: 'Revisa el email.' },
				formError: 'Ese dominio de email no admite registros. Usa otra dirección.'
			}
		});

		expect(screen.getByRole('alert')).toHaveTextContent(
			'Ese dominio de email no admite registros. Usa otra dirección.'
		);
		expect(screen.getByRole('link', { name: 'Revisa el email.' })).toHaveAttribute(
			'href',
			'#email'
		);
		expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAttribute('aria-invalid', 'true');
	});

	it('los campos ocultos (app de origen y versiones legales) y el captcha van dentro del formulario', () => {
		const { container } = render(RegisterForm, {
			props: { ...base, originSlug: 'secretario', turnstileSiteKey: 'clave-publica' }
		});
		const form = formIn(container);

		expect(form.querySelector('input[name="app"]')).toHaveValue('secretario');
		expect(form.querySelector('input[name="versionTerms"]')).toHaveValue('2026-06');
		expect(form.querySelector('input[name="versionPrivacy"]')).toHaveValue('2026-06');
		expect(form.querySelector('input[name="versionAup"]')).toHaveValue('2026-06');
		expect(form.querySelector('.cf-turnstile')).toHaveAttribute('data-sitekey', 'clave-publica');
	});
});
