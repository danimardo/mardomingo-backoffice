// Motivo de las acciones de administración (BE-FR-55, FR-094; C-55, cierra R08 y D09): de 1 a 500 caracteres tras recortar. Regla
// única para los servicios (`$lib/server/shared/reason`), las acciones web y el `maxlength` de los campos. Pura.

/** Longitud máxima del motivo, contada tras recortar los espacios de los extremos. */
export const REASON_MAX_LENGTH = 500;

/** Por qué un motivo no vale: vacío (o solo espacios) o demasiado largo. Son también los códigos de error del campo en la web. */
export type ReasonIssue = 'validation_required' | 'reason_too_long';

/** El problema del motivo, o `null` si vale. */
export function reasonIssueOf(reason: string): ReasonIssue | null {
	const trimmed = reason.trim();
	if (trimmed === '') return 'validation_required';
	if (trimmed.length > REASON_MAX_LENGTH) return 'reason_too_long';
	return null;
}
