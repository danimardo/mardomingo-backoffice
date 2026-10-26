// Operaciones de IA para las pruebas (T121, T173): filas `in_progress` en `ai_operations`, para que una reserva de `credits`
// tenga la clave foránea que exige. La fila la abre el servicio de `ai` (`openInFlightOperation`), sin llamar al proveedor.
import { openInFlightOperation } from '$lib/server/features/ai';
import type { Db } from '$lib/server/db/client';
import { SEEDED_APP_ID } from '../setup/integration.global-setup';

const SEEDED_OPERATION = 'aop_secretario_improve';

let counter = 0;

/** Abre una operación en curso del usuario y devuelve su id. */
export function insertInFlightOperation(
	db: Db,
	input: { readonly userId: string; readonly appId?: string; readonly appOperationId?: string }
): string {
	counter += 1;
	return openInFlightOperation(db, {
		id: `aio_test_${String(counter)}`,
		userId: input.userId,
		appId: input.appId ?? SEEDED_APP_ID,
		appOperationId: input.appOperationId ?? SEEDED_OPERATION
	});
}
