// Banner de estado (DS-06, UX-12; T257): el nivel se escribe como texto y el crítico se anuncia como alerta.
import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import Banner from './Banner.svelte';

function text(value: string) {
	return createRawSnippet(() => ({ render: () => `<span>${value}</span>` }));
}

describe('Banner', () => {
	it('escribe el nivel como texto además del color', () => {
		render(Banner, { props: { level: 'warning', children: text('El saldo es bajo.') } });

		expect(screen.getByText('Aviso:')).toBeTruthy();
		expect(screen.getByText('El saldo es bajo.')).toBeTruthy();
	});

	it('el nivel crítico se anuncia como alerta', () => {
		const { container } = render(Banner, {
			props: { level: 'critical', children: text('Cuenta bloqueada.') }
		});

		expect(screen.getByText('Crítico:')).toBeTruthy();
		expect(container.querySelector('[role="alert"]')).not.toBeNull();
	});
});
