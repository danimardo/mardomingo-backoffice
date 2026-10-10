// Apariencia por contexto (DS-03): sin `localStorage` ni estado de módulo mutable. La preferencia viene de las
// cookies que lee el servidor (la primera pintura ya es correcta); el estado vive en el contexto del layout y,
// con JavaScript, un envío de los controles la actualiza sin recargar (UX-TEMA CA2–CA3).
import { getContext, setContext } from 'svelte';
import type { Appearance, Effects, Theme } from '$lib/appearance/preferences';

const APPEARANCE_KEY = Symbol('appearance');

export class AppearanceState {
	theme = $state<Theme>('system');
	effects = $state<Effects>('normal');

	constructor(initial: Appearance) {
		this.theme = initial.theme;
		this.effects = initial.effects;
	}

	/** Adopta la apariencia confirmada por el servidor tras un envío. */
	update(next: Appearance): void {
		this.theme = next.theme;
		this.effects = next.effects;
	}
}

export function provideAppearance(state: AppearanceState): void {
	setContext(APPEARANCE_KEY, state);
}

export function useAppearance(): AppearanceState {
	return getContext<AppearanceState>(APPEARANCE_KEY);
}

/** Atributos de `<html>`: solo hay atributo cuando la persona ha elegido algo distinto del sistema/normal. */
export function applyToRoot(
	root: Pick<HTMLElement, 'setAttribute' | 'removeAttribute'>,
	appearance: Appearance
): void {
	if (appearance.theme === 'system') root.removeAttribute('data-theme');
	else root.setAttribute('data-theme', appearance.theme);

	if (appearance.effects === 'reduced') root.setAttribute('data-effects', 'reduced');
	else root.removeAttribute('data-effects');
}
