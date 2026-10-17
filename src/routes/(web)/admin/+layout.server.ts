// Layout de administración (W33–W50; BE-FR-10, T300). No es barrera: cada página y cada acción vuelven a comprobar el rol de
// administrador (T301). Aquí solo se decide qué se muestra en la navegación.
import { accessFor } from '$lib/server/features/accounts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
	isAdmin: accessFor(locals.user, 'admin').kind === 'allow'
});
