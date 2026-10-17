// Patrón de confirmación de las acciones destructivas de administración (contracts/web-routes.md 1.4; UX-13, UX-14; T302).
// Dos pasos, ambos POST: la primera envía sin `confirmado` y solo previsualiza (no cambia nada); la segunda envía con
// `confirmado=true` y aplica. El motivo es obligatorio en los dos pasos. Quien aplica decide con `isConfirmed`; el servicio que
// aplica es el que impide la doble aplicación (idempotencia de cada acción).
export const CONFIRM_FIELD = 'confirmado';

/** `true` si el formulario pide aplicar (segundo paso); cualquier otra cosa es solo vista previa. */
export function isConfirmed(form: FormData): boolean {
	return form.get(CONFIRM_FIELD) === 'true';
}

/** Enlace tras aplicar: aviso `saved` y la entrada de auditoría creada, para que la página enlace con ella (UX-13). */
export function savedRedirect(path: string, entryId: string): string {
	const query = new URLSearchParams({ aviso: 'saved', auditoria: entryId });
	return `${path}?${query.toString()}`;
}
