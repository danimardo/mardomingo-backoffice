// Cuenta origen de la copia de predeterminados (BE-FR-42 CA3; D03 = R13 de la propuesta de administración). Puro: sin I/O.
/**
 * La copia solo puede tomar el documento de sincronización de la cuenta del propio administrador. Sin parámetro (o vacío)
 * es esa cuenta; otra cuenta, aunque exista, devuelve `null` y la ruta responde 403.
 */
export function copySourceUserId(adminId: string, requested: string | null): string | null {
	if (requested === null || requested === '') return adminId;
	return requested === adminId ? adminId : null;
}
