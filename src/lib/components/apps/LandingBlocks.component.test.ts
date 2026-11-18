// Bloques de la landing (W01): pestañas con WAI-ARIA y teclado, rejilla de ventajas y FAQ con <details>.
import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import FaqList from './FaqList.svelte';
import FeatureGrid from './FeatureGrid.svelte';
import FeatureTabs from './FeatureTabs.svelte';

const tabs = [
	{ id: 'a', label: 'Uno', title: 'Título uno', text: 'Texto uno' },
	{ id: 'b', label: 'Dos', title: 'Título dos', text: 'Texto dos' },
	{ id: 'c', label: 'Tres', title: 'Título tres', text: 'Texto tres' }
] as const;

function active(): Element {
	const el = document.activeElement;
	if (el === null) throw new Error('Sin elemento enfocado');
	return el;
}

describe('FeatureTabs', () => {
	it('muestra solo el panel de la pestaña activa y marca aria-selected', () => {
		render(FeatureTabs, { props: { label: 'Funciones', tabs } });

		expect(screen.getByRole('tablist', { name: 'Funciones' })).toBeTruthy();
		expect(screen.getByRole('tab', { name: 'Uno' }).getAttribute('aria-selected')).toBe('true');
		expect(screen.getByRole('tab', { name: 'Dos' }).getAttribute('aria-selected')).toBe('false');
		expect(screen.getByRole('tabpanel', { name: 'Uno' })).toBeTruthy();
		expect(screen.queryByRole('tabpanel', { name: 'Dos' })).toBeNull();
	});

	it('solo la pestaña activa entra en el orden de tabulación', () => {
		render(FeatureTabs, { props: { label: 'Funciones', tabs } });

		expect(screen.getByRole('tab', { name: 'Uno' }).getAttribute('tabindex')).toBe('0');
		expect(screen.getByRole('tab', { name: 'Dos' }).getAttribute('tabindex')).toBe('-1');
	});

	it('la flecha derecha activa y enfoca la siguiente, y Fin va a la última', async () => {
		render(FeatureTabs, { props: { label: 'Funciones', tabs } });

		screen.getByRole('tab', { name: 'Uno' }).focus();
		await fireEvent.keyDown(active(), { key: 'ArrowRight' });
		expect(screen.getByRole('tab', { name: 'Dos' }).getAttribute('aria-selected')).toBe('true');
		expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Dos' }));

		await fireEvent.keyDown(active(), { key: 'End' });
		expect(screen.getByRole('tab', { name: 'Tres' }).getAttribute('aria-selected')).toBe('true');

		await fireEvent.keyDown(active(), { key: 'ArrowRight' });
		expect(screen.getByRole('tab', { name: 'Uno' }).getAttribute('aria-selected')).toBe('true');
	});

	it('un clic cambia de pestaña', async () => {
		render(FeatureTabs, { props: { label: 'Funciones', tabs } });

		await fireEvent.click(screen.getByRole('tab', { name: 'Tres' }));
		expect(screen.getByRole('tabpanel', { name: 'Tres' })).toBeTruthy();
	});
});

describe('FeatureGrid', () => {
	it('pinta el título, y cada ventaja con su icono decorativo', () => {
		const { container } = render(FeatureGrid, {
			props: {
				eyebrow: 'Y además',
				title: 'Bajo el capó',
				items: [
					{ icon: 'user', title: 'Una cuenta', text: 'Para todas' },
					{ icon: 'wallet', title: 'Un saldo', text: 'Compartido' }
				]
			}
		});

		expect(screen.getByRole('heading', { name: 'Bajo el capó' })).toBeTruthy();
		expect(screen.getAllByRole('listitem')).toHaveLength(2);
		expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(2);
	});
});

describe('FaqList', () => {
	it('cada pregunta es un <details> cerrado con su respuesta, agrupados con el mismo name', () => {
		const { container } = render(FaqList, {
			props: {
				title: 'Preguntas',
				items: [
					{ question: '¿Uno?', answer: 'Sí.' },
					{ question: '¿Dos?', answer: 'No.' }
				]
			}
		});

		const details = [...container.querySelectorAll('details')];
		expect(details).toHaveLength(2);
		expect(details.every((d) => !d.open && d.getAttribute('name') === 'faq')).toBe(true);
		expect(screen.getByRole('heading', { name: 'Preguntas' })).toBeTruthy();
	});
});
