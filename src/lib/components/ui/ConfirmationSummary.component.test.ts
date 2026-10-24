// Resumen de confirmación (UX-13, UX-14; T302): usuario, importe, antes → después y alcance; sin importe ni cambio, esas filas no salen.
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import ConfirmationSummary from './ConfirmationSummary.svelte';

describe('ConfirmationSummary', () => {
	it('[UX-14] muestra el usuario, el importe, el cambio y el alcance', () => {
		render(ConfirmationSummary, {
			props: {
				subject: 'ana@ejemplo.es',
				amount: '25 créditos',
				before: '10',
				after: '35',
				scope: 'Global'
			}
		});

		expect(screen.getByText('ana@ejemplo.es')).toBeInTheDocument();
		expect(screen.getByText('25 créditos')).toBeInTheDocument();
		expect(screen.getByText('10 → 35')).toBeInTheDocument();
		expect(screen.getByText('Global')).toBeInTheDocument();
	});

	it('sin importe ni cambio, esas filas no salen', () => {
		render(ConfirmationSummary, { props: { subject: 'Secretario AI', scope: 'Por app' } });

		expect(screen.queryByText('Importe')).not.toBeInTheDocument();
		expect(screen.queryByText('Antes → después')).not.toBeInTheDocument();
		expect(screen.getByText('Por app')).toBeInTheDocument();
	});
});
