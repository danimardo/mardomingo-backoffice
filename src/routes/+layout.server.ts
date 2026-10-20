// Datos del layout raíz (contracts/web-routes.md 1.9): apariencia, nivel de log del navegador y variables públicas.
// Es el único layout con datos; el panel y la administración lo amplían en sus lotes.
import { getComposition } from '$lib/server/composition.cache';
import { accessFor } from '$lib/server/features/accounts';
import { supportEmail } from '$lib/server/features/apps';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	const { config, apps } = getComposition();
	return {
		appearance: locals.appearance,
		clientLogLevel: config.CLIENT_LOG_LEVEL,
		publicWebUrl: config.PUBLIC_WEB_URL,
		supportEmail: supportEmail(apps),
		// El marco muestra «Entrar» o el menú de cuenta; la administración solo a quien pasa su guarda.
		account: {
			signedIn: locals.user !== null,
			isAdmin: accessFor(locals.user, 'admin').kind === 'allow'
		}
	};
};
