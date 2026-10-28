// Formato del slug de una app (D10 = R15 de la propuesta de administración). Puro. El slug es el identificador que la app
// cliente envía en cada petición (`X-App-Id`), así que se fija al dar de alta y no se edita después.
const SLUG_PATTERN = /^[a-z][a-z0-9-]{1,39}$/;

/** `true` si el slug tiene de 2 a 40 caracteres, empieza por letra minúscula y sigue con minúsculas, dígitos o guiones. */
export function isValidSlug(slug: string): boolean {
	return SLUG_PATTERN.test(slug);
}
