// W16 · `/preferencias` (contracts/web-routes.md; UX-TEMA, UX-EFECTOS; DS-03). Dos acciones con POST-redirect-GET:
// el tema y los efectos se guardan en cookies técnicas `Path=/` que el servidor lee en la siguiente petición.
import { redirect, type Cookies } from '@sveltejs/kit';
import * as z from 'zod';
import { parseForm } from '$lib/server/forms';
import {
	EFFECTS_COOKIE,
	THEME_COOKIE,
	safeInternalPath,
	themeSchema
} from '$lib/appearance/preferences';
import type { Actions, PageServerLoad } from './$types';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const themeForm = z.strictObject({
	theme: themeSchema,
	redirectTo: z.string().optional()
});

const effectsForm = z.strictObject({
	effects: z.literal('reduced').optional(),
	redirectTo: z.string().optional()
});

export const load: PageServerLoad = ({ locals, url }) => ({
	appearance: locals.appearance,
	// Sin `redirectTo` en la query, vuelve a esta misma página tras guardar (no a la portada).
	redirectTo: safeInternalPath(url.searchParams.get('redirectTo') ?? url.pathname)
});

export const actions: Actions = {
	tema: async ({ request, cookies }) => {
		const parsed = parseForm(themeForm, await request.formData());
		if (!parsed.ok) return parsed.failure;

		writeCookie(cookies, THEME_COOKIE, parsed.data.theme === 'system' ? null : parsed.data.theme);
		redirect(303, safeInternalPath(parsed.data.redirectTo));
	},

	efectos: async ({ request, cookies }) => {
		const parsed = parseForm(effectsForm, await request.formData());
		if (!parsed.ok) return parsed.failure;

		// Casilla desmarcada = sin campo = normal: la cookie se borra.
		writeCookie(cookies, EFFECTS_COOKIE, parsed.data.effects === 'reduced' ? 'reduced' : null);
		redirect(303, safeInternalPath(parsed.data.redirectTo));
	}
};

/** `null` borra la cookie: vuelve el valor por defecto (sistema o normal). */
function writeCookie(cookies: Cookies, name: string, value: string | null): void {
	if (value === null) {
		cookies.delete(name, { path: '/' });
		return;
	}
	cookies.set(name, value, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: true,
		maxAge: ONE_YEAR_SECONDS
	});
}
