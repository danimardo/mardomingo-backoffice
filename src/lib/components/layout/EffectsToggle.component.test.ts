import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import EffectsToggle from './EffectsToggle.svelte';

describe('EffectsToggle', () => {
	it('la casilla refleja el ajuste y tiene nombre accesible', () => {
		render(EffectsToggle, { props: { current: 'reduced', redirectTo: '/' } });

		expect(
			screen.getByRole('checkbox', { name: 'Reducir transparencia y movimiento' })
		).toBeChecked();
	});

	it('sin ajuste, la casilla queda desmarcada', () => {
		render(EffectsToggle, { props: { current: 'normal', redirectTo: '/' } });

		expect(screen.getByRole('checkbox')).not.toBeChecked();
	});

	it('envía a la acción de efectos', () => {
		const { container } = render(EffectsToggle, { props: { current: 'normal', redirectTo: '/' } });

		expect(container.querySelector('form')?.getAttribute('action')).toBe('/preferencias?/efectos');
	});
});
