// Lectura del cuerpo JSON de la API. Un cuerpo que no es JSON se trata como ausente: la ruta responde `VALIDATION_ERROR`
// con el campo, nunca con el texto recibido.

/** Cuerpo JSON de una petición, o `undefined` si no es JSON válido. */
export async function jsonBodyOf(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		return undefined;
	}
}

/** Primer campo que no encaja, para `details.field` de `VALIDATION_ERROR`. Nunca su valor. */
export function firstIssuePath(
	issues: readonly { readonly path: readonly PropertyKey[] }[]
): string {
	const path = issues[0]?.path ?? [];
	return path.map((segment) => String(segment)).join('.') || 'body';
}
