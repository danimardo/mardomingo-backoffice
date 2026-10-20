// Parámetro `[slug=appSlug]` (contracts/web-routes.md W02): el mismo formato que la restricción de la tabla `apps`. Un valor
// que no lo cumple ni llega al `load`: la ruta no casa y SvelteKit responde 404.
import type { ParamMatcher } from '@sveltejs/kit';

export const match: ParamMatcher = (param) => /^[a-z][a-z0-9-]*$/.test(param);
