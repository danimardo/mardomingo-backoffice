// Operaciones de IA para las pruebas (T121): filas `in_progress` en `ai_operations`, para que una reserva de `credits`
// tenga la clave foránea que exige. La inserción directa es una excepción documentada hasta que L07 la sustituya por el
// servicio de `ai`.
import { aiOperations } from '$lib/server/features/ai/schema';
import type { Db } from '$lib/server/db/client';
import { SEEDED_APP_ID } from '../setup/integration.global-setup';

const SEEDED_OPERATION = 'aop_secretario_improve';

let counter = 0;

/** Inserta una operación en curso del usuario y devuelve su id. */
export function insertInFlightOperation(
	db: Db,
	input: { readonly userId: string; readonly appId?: string; readonly appOperationId?: string }
): string {
	counter += 1;
	const id = `aio_test_${String(counter)}`;
	db.insert(aiOperations)
		.values({
			id,
			userId: input.userId,
			appId: input.appId ?? SEEDED_APP_ID,
			appOperationId: input.appOperationId ?? SEEDED_OPERATION,
			status: 'in_progress'
		})
		.run();
	return id;
}
