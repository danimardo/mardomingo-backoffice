// Icono (ADR 0009, T456): cada nombre de la API renderiza un <svg> de Lucide, decorativo o con nombre accesible.
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Icon from './Icon.svelte';
import { ICONS, type IconName } from './icons';

const names: IconName[] = [
	'check',
	'alert-triangle',
	'x-circle',
	'info',
	'close',
	'search',
	'chevron-down',
	'external-link',
	'arrow-right',
	'shield',
	'settings',
	'home',
	'clock',
	'refresh',
	'copy',
	'edit',
	'trash',
	'filter'
];

describe('Icon', () => {
	it('la lista de la prueba cubre todos los nombres de ICONS', () => {
		expect([...names].sort()).toEqual(Object.keys(ICONS).sort());
	});

	it.each(names)('«%s» renderiza un <svg> decorativo con aria-hidden', (name) => {
		const { container } = render(Icon, { props: { name } });
		const svg = container.querySelector('svg');

		expect(svg).not.toBeNull();
		expect(svg?.getAttribute('aria-hidden')).toBe('true');
		expect(svg?.getAttribute('aria-label')).toBeNull();
		expect(svg?.getAttribute('stroke')).toBe('currentColor');
		expect(svg?.querySelector('path, circle, line, rect, polyline')).not.toBeNull();
	});

	it.each(names)('«%s» con label es una imagen con nombre accesible', (name) => {
		const { container } = render(Icon, { props: { name, label: 'Aviso' } });
		const svg = container.querySelector('svg');

		expect(svg?.getAttribute('role')).toBe('img');
		expect(svg?.getAttribute('aria-label')).toBe('Aviso');
		expect(svg?.getAttribute('aria-hidden')).toBeNull();
	});

	it('aplica el tamaño y el grosor de trazo recibidos', () => {
		const { container } = render(Icon, { props: { name: 'check', size: 16, strokeWidth: 1.5 } });
		const svg = container.querySelector('svg');

		expect(svg?.getAttribute('width')).toBe('16');
		expect(svg?.getAttribute('height')).toBe('16');
		expect(svg?.getAttribute('stroke-width')).toBe('1.5');
	});
});
