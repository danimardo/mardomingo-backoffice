// Campo de motivo de las páginas de administración (BE-FR-55; C-55). Lee la respuesta de la acción (`form`): el error del motivo
// junto al campo del formulario que falló (`scope`) y el texto escrito, para no perderlo. Una sola regla de mensajes para todas.
import * as m from '$lib/paraglide/messages.js';

export { REASON_MAX_LENGTH } from '$lib/shared/reason';

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === 'object' && value !== null;
}

function recordOf(value: unknown): Readonly<Record<string, unknown>> | null {
	return isRecord(value) ? value : null;
}

function textAt(value: unknown, key: string): string | null {
	const field = recordOf(value)?.[key];
	return typeof field === 'string' ? field : null;
}

/** Texto visible de un código de error del motivo; vacío si no hay error. */
function messageOf(code: string | null): string {
	if (code === 'reason_too_long') return m.validation_reason_too_long();
	if (code === 'validation_required') return m.validation_required();
	return '';
}

/**
 * Valor y error del campo de motivo de un formulario. Con `scope`, solo si la respuesta es de ese formulario (una página con varios
 * formularios con motivo pinta el error solo en el suyo); sin `scope`, la página tiene un único campo de motivo.
 */
export function reasonFieldOf(
	form: unknown,
	scope?: string
): { readonly value: string; readonly error: string } {
	const response = recordOf(form);
	if (response === null) return { value: '', error: '' };
	if (scope !== undefined && response.scope !== scope) return { value: '', error: '' };
	return {
		value: textAt(response.values, 'motivo') ?? '',
		error: messageOf(textAt(response.errors, 'motivo'))
	};
}
