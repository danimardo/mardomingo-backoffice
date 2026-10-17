// Destino tras iniciar sesión (contracts/web-routes.md 1.2): solo rutas internas relativas. Cualquier otro valor se
// sustituye por `/panel`, así que no hay redirecciones abiertas. Función pura.

/** Ruta interna: empieza por `/` pero no por `//`, sin barras invertidas ni espacios, y como mucho 2048 caracteres. */
const INTERNAL_PATH = /^\/(?!\/)[^\\\s]*$/;
export const REDIRECT_MAX_LENGTH = 2048;
const DEFAULT_DESTINATION = '/panel';

/** Devuelve `value` si es una ruta interna válida; si no, `/panel`. */
export function safeRedirect(value: string | null | undefined): string {
	if (value === undefined || value === null) return DEFAULT_DESTINATION;
	if (value.length > REDIRECT_MAX_LENGTH || !INTERNAL_PATH.test(value)) return DEFAULT_DESTINATION;
	return value;
}
