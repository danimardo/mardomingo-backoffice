// Datos del layout raíz (contracts/web-routes.md 1.9): apariencia, nivel de log del navegador y variables públicas.
// Es el único layout con datos; el panel y la administración lo amplían en sus lotes.
import { getComposition } from '$lib/server/composition.cache';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	const { config } = getComposition();
	return {
		appearance: locals.appearance,
		clientLogLevel: config.CLIENT_LOG_LEVEL,
		publicWebUrl: config.PUBLIC_WEB_URL,
		// El correo de soporte sale de la configuración de las apps (L02).
		supportEmail: null,
		// Sin sesión hasta L03: el marco muestra «Entrar».
		account: { signedIn: false, isAdmin: false }
	};
};
