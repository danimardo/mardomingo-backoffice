// W08 · `/registro` (contracts/web-routes.md W08; BE-FR-01, 11, 64, 69; UX-01, UX-02). Con sesión, va al panel. El
// registro lo decide `accounts` (captcha, antiabuso, aceptaciones y email); esta ruta solo lee, valida y traduce.
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import {
	REGISTER_CHECKBOXES,
	RegisterSchema,
	PASSWORD_MAX,
	PASSWORD_MIN
} from '$lib/schemas/accounts/register';
import { getComposition } from '$lib/server/composition.cache';
import { findActiveAppBySlug, getSetting } from '$lib/server/features/apps';
import { currentVersions } from '$lib/server/features/legal';
import { parseForm } from '$lib/server/forms';
import { AppError } from '$lib/server/shared/errors';
import { clientIpOf, failureOf } from '$lib/server/web/actions';
import { legalHrefOf } from '$lib/server/web/legal-page';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user !== null) {
		const panel = resolve('/panel');
		redirect(303, panel);
	}
	const composition = getComposition();
	const slug = url.searchParams.get('app');
	const origin = slug === null ? undefined : findActiveAppBySlug(composition.apps, slug);
	const versions = currentVersions(composition.legal, composition.clock.now(), [
		'terms',
		'privacy',
		'aup'
	]);
	const minAge = getSetting(composition.apps, 'min_age');
	return {
		originApp: origin === undefined ? null : { slug: slug ?? '', name: origin.name },
		legal: [...versions.entries()].map(([kind, current]) => ({
			kind,
			version: current.version,
			url: legalHrefOf(kind) ?? ''
		})),
		minAge: typeof minAge === 'number' ? minAge : 18,
		passwordRule: { min: PASSWORD_MIN, max: PASSWORD_MAX },
		turnstileSiteKey: composition.config.PUBLIC_TURNSTILE_SITE_KEY
	};
};

export const actions: Actions = {
	registrar: async ({ request, getClientAddress }) => {
		const parsed = parseForm(RegisterSchema, await request.formData(), {
			booleans: REGISTER_CHECKBOXES
		});
		if (!parsed.ok) return parsed.failure;

		try {
			const result = await getComposition().accounts.register({
				email: parsed.data.email,
				password: parsed.data.password,
				captchaToken: parsed.data['cf-turnstile-response'] ?? '',
				remoteIp: clientIpOf(getClientAddress),
				appSlug: parsed.data.app ?? null,
				versions: {
					terms: parsed.data.versionTerms,
					privacy: parsed.data.versionPrivacy,
					aup: parsed.data.versionAup
				},
				ageDeclared: parsed.data.ageDeclaration
			});
			return { success: true, sentTo: result.sentTo };
		} catch (error) {
			if (error instanceof AppError) return failureOf(error, { email: parsed.data.email });
			throw error;
		}
	}
};
