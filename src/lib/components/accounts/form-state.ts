// Estado de un formulario de la cuenta, leído del resultado de su acción (`form`). Se valida con Zod porque la forma
// de `form` depende de la acción y de su rama; así las páginas reciben un estado ya tipado y sin comprobaciones de más.
import * as z from 'zod';
import { formErrorText } from './messages';

export interface FormState {
	/** Errores por campo (`fail(400, { errors })`). */
	readonly errors: Readonly<Record<string, string>>;
	/** Código del catálogo de error de negocio, o cadena vacía. */
	readonly code: string;
	/** Texto visible del error de negocio, o cadena vacía. */
	readonly formError: string;
	/** La acción terminó bien sin redirigir (`{ success: true }`). */
	readonly success: boolean;
	/** Dirección a la que se envió el email, en el registro. */
	readonly sentTo: string | null;
}

const STATE = z.object({
	errors: z.record(z.string(), z.string()).optional(),
	formError: z.string().optional(),
	retryAfterMinutes: z.number().optional(),
	success: z.boolean().optional(),
	sentTo: z.string().optional()
});

const EMPTY: FormState = Object.freeze({
	errors: {},
	code: '',
	formError: '',
	success: false,
	sentTo: null
});

export function formStateOf(form: unknown): FormState {
	const parsed = STATE.safeParse(form);
	if (!parsed.success) return EMPTY;
	const data = parsed.data;
	const code = data.formError ?? '';
	return {
		errors: data.errors ?? {},
		code,
		formError: code === '' ? '' : formErrorText(code, data.retryAfterMinutes),
		success: data.success === true,
		sentTo: data.sentTo ?? null
	};
}
