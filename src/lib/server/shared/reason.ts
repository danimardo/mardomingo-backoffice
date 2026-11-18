// Motivo obligatorio de 1 a 500 caracteres en los servicios que auditan una acción de administración (BE-FR-55; C-55). Única regla
// del servidor: la usan `accounts`, `apps`, `notifications`, `pricing`, `credits`, `payments`, `sync` y `protections`.
import { reasonIssueOf } from '$lib/shared/reason';
import { AppError } from './errors';

/** Devuelve el motivo recortado, que es el que se audita; vacío o de más de 500 caracteres es `VALIDATION_ERROR` en `reason`. */
export function requireReason(reason: string): string {
	if (reasonIssueOf(reason) !== null) throw new AppError('VALIDATION_ERROR', { field: 'reason' });
	return reason.trim();
}
