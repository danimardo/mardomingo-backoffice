import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import ErrorSummary from './ErrorSummary.svelte';

describe('ErrorSummary', () => {
	it('cada error enlaza con su campo y el resumen se anuncia como alerta', () => {
		render(ErrorSummary, { props: { errors: { email: 'Revisa el email.' } } });

		const alert = screen.getByRole('alert');
		expect(alert.textContent).toContain('Revisa el email.');
		expect(screen.getByRole('link', { name: 'Revisa el email.' }).getAttribute('href')).toBe(
			'#email'
		);
	});

	it('toma el foco al mostrarse, para que el lector de pantalla lo anuncie', async () => {
		render(ErrorSummary, { props: { errors: { password: 'Obligatoria.' } } });

		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(document.activeElement).toBe(screen.getByRole('alert'));
	});

	it('no se muestra si no hay errores', () => {
		render(ErrorSummary, { props: { errors: {} } });

		expect(screen.queryByRole('alert')).toBeNull();
	});
});
