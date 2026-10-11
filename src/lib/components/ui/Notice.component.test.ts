import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import Notice from './Notice.svelte';

function text(value: string) {
	return createRawSnippet(() => ({ render: () => `<span>${value}</span>` }));
}

describe('Notice', () => {
	it('por defecto es informativo: se anuncia como estado, no como alerta', () => {
		render(Notice, { props: { children: text('Te hemos enviado un email.') } });

		expect(screen.getByRole('status').textContent).toContain('Te hemos enviado un email.');
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('el tono de peligro se anuncia como alerta', () => {
		render(Notice, { props: { tone: 'danger', children: text('No se ha podido enviar.') } });

		expect(screen.getByRole('alert').textContent).toContain('No se ha podido enviar.');
	});
});
