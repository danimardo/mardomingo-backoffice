// Preferencias de apariencia (UX-TEMA, UX-EFECTOS; contracts/web-routes.md W16). Viven en dos cookies
// `Path=/` que valida Zod en el servidor: un valor inválido se ignora y cuenta como «sistema» o «normal».
import * as z from 'zod';

export const THEME_COOKIE = 'mdm_theme';
export const EFFECTS_COOKIE = 'mdm_effects';

export const themeSchema = z.enum(['system', 'light', 'dark']);
export const effectsSchema = z.enum(['normal', 'reduced']);

export type Theme = z.infer<typeof themeSchema>;
export type Effects = z.infer<typeof effectsSchema>;

export interface Appearance {
	readonly theme: Theme;
	readonly effects: Effects;
}

export const DEFAULT_APPEARANCE: Appearance = { theme: 'system', effects: 'normal' };

/** Lee las cookies. Sin cookie o con valor inválido, el valor por defecto. */
export function appearanceFromCookies(read: (name: string) => string | undefined): Appearance {
	const theme = z.enum(['light', 'dark']).safeParse(read(THEME_COOKIE));
	const effects = z.literal('reduced').safeParse(read(EFFECTS_COOKIE));
	return {
		theme: theme.success ? theme.data : 'system',
		effects: effects.success ? 'reduced' : 'normal'
	};
}

/** Atributos de `<html>` para pintar la apariencia desde el servidor (sin destello). */
export function appearanceAttributes(appearance: Appearance): string {
	const attributes: string[] = [];
	if (appearance.theme !== 'system') attributes.push(`data-theme="${appearance.theme}"`);
	if (appearance.effects === 'reduced') attributes.push('data-effects="reduced"');
	return attributes.join(' ');
}

/** Ruta interna para volver tras un envío. Cualquier otra cosa (URL externa, `//`, barras invertidas) va a `/`. */
export function safeInternalPath(value: string | null | undefined): string {
	if (value === undefined || value === null) return '/';
	if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
	return value;
}
