import { describe, expect, it } from 'vitest';
import { AppearanceState, applyToRoot } from './theme.svelte';

function fakeRoot() {
	const attributes = new Map<string, string>();
	return {
		attributes,
		setAttribute: (name: string, value: string) => {
			attributes.set(name, value);
		},
		removeAttribute: (name: string) => {
			attributes.delete(name);
		}
	};
}

describe('applyToRoot', () => {
	it('sistema y normal no dejan atributos: el CSS decide con prefers-color-scheme', () => {
		const root = fakeRoot();

		applyToRoot(root, { theme: 'system', effects: 'normal' });

		expect(root.attributes.size).toBe(0);
	});

	it('una elección explícita se escribe en data-theme y data-effects', () => {
		const root = fakeRoot();

		applyToRoot(root, { theme: 'light', effects: 'reduced' });

		expect(root.attributes.get('data-theme')).toBe('light');
		expect(root.attributes.get('data-effects')).toBe('reduced');
	});

	it('volver a sistema quita el atributo de tema', () => {
		const root = fakeRoot();
		applyToRoot(root, { theme: 'dark', effects: 'normal' });

		applyToRoot(root, { theme: 'system', effects: 'normal' });

		expect(root.attributes.has('data-theme')).toBe(false);
	});
});

describe('AppearanceState', () => {
	it('arranca con la apariencia del servidor y la adopta tras un envío', () => {
		const state = new AppearanceState({ theme: 'system', effects: 'normal' });

		state.update({ theme: 'dark', effects: 'reduced' });

		expect(state.theme).toBe('dark');
		expect(state.effects).toBe('reduced');
	});
});
