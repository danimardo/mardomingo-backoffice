// Parámetro `[key=operationKey]` (contracts/web-routes.md W41): clave de una operación de IA dentro de su app (`improve`,
// `enhance`, `image-generation`…). Minúsculas, dígitos y guiones, empezando por letra; si no cumple, la ruta no casa y responde 404.
// El formato no lo fija el contrato: esta regla se propone a partir de las claves sembradas (pendiente de confirmar).
import type { ParamMatcher } from '@sveltejs/kit';

export const match: ParamMatcher = (param) => /^[a-z][a-z0-9-]{0,63}$/.test(param);
