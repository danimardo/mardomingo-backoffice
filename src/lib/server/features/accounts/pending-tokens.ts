// Tokens pendientes en `verification` que un cambio de credenciales debe anular (C-15, C-20; BE-FR-05, BE-FR-66/CA6).
// Better Auth guarda la recuperación como `reset-password:<token>` con el id del usuario en `value`; el cambio de email
// (`email-change:<hash>`) lleva el id dentro de su JSON. Se borran dentro de la transacción que ya cambia la credencial.
import { and, eq, like, sql } from 'drizzle-orm';
import type { Tx } from '$lib/server/db/tx';
import { verification } from './schema';

/** Borra todos los enlaces de recuperación de contraseña pendientes del usuario. */
export function deleteResetTokens(tx: Tx, userId: string): void {
	tx.delete(verification)
		.where(and(like(verification.identifier, 'reset-password:%'), eq(verification.value, userId)))
		.run();
}

/** Borra todos los cambios de email pendientes del usuario. */
export function deletePendingEmailChanges(tx: Tx, userId: string): void {
	tx.delete(verification)
		.where(
			and(
				like(verification.identifier, 'email-change:%'),
				sql`json_extract(${verification.value}, '$.userId') = ${userId}`
			)
		)
		.run();
}
