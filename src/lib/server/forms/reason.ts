// Rechazo del motivo en las acciones web de administración (BE-FR-55; C-55): antes de llamar al servicio, un motivo vacío o de más
// de 500 caracteres responde 400 con el error en `errors.motivo`, lo escrito en `values` y el formulario que falló en `scope`, para
// que la página lo pinte junto a su campo (`reasonFieldOf`). El servicio aplica la misma regla (`requireReason`).
import { fail } from '@sveltejs/kit';
import { reasonIssueOf } from '$lib/shared/reason';

type NoFields = Record<string, never>;

export interface ReasonRejectionOptions<Values extends object, Extra extends object> {
	/** Formulario de la página que falló, cuando hay varios con motivo. */
	readonly scope?: string;
	/** Otros valores escritos que la página vuelve a pintar. */
	readonly values?: Values;
	/** Datos que la página necesita para volver a mostrar el formulario (p. ej. la vista previa que lo contiene). */
	readonly extra?: Extra;
}

/** `fail(400)` si el motivo no vale; `null` si vale. */
export function reasonRejection<Values extends object = NoFields, Extra extends object = NoFields>(
	reason: string,
	options: ReasonRejectionOptions<Values, Extra> = {}
) {
	const issue = reasonIssueOf(reason);
	if (issue === null) return null;
	// `Object.assign` tipa el resultado como `Values & { motivo }` aunque falten `values` o `extra` (un spread de un opcional
	// añadiría a la unión una variante sin los campos de la página).
	const values = Object.assign({}, options.values, { motivo: reason });
	return fail(
		400,
		Object.assign({}, options.extra, {
			errors: { motivo: issue },
			values,
			scope: options.scope ?? null
		})
	);
}
