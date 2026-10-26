// Estado vacío (DS-06, T362): distingue «sin datos» de «ningún resultado con el filtro» y anuncia el cambio con aria-live.
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import EmptyState from './EmptyState.svelte';

describe('EmptyState', () => {
	it('anuncia el cambio con aria-live y tiene un encabezado', () => {
		const { container } = render(EmptyState, { props: { variant: 'empty' } });

		const section = container.querySelector('section.empty');
		expect(section?.getAttribute('aria-live')).toBe('polite');
		expect(container.querySelector('h2')).not.toBeNull();
	});

	it('con «no-match» muestra el filtro activo', () => {
		const { container } = render(EmptyState, {
			props: { variant: 'no-match', filter: 'usuario.e2e' }
		});

		expect(container.textContent).toContain('usuario.e2e');
	});

	it('con «empty» no repite ningún filtro', () => {
		const { container } = render(EmptyState, { props: { variant: 'empty' } });

		expect(container.textContent).not.toContain('usuario.e2e');
	});
});
