// Abre una operación de IA «en curso» sin llamar al proveedor (T173). Lo usan las pruebas de otras funcionalidades que
// necesitan una fila `in_progress` como clave foránea de una reserva. La fila se escribe con el mismo repositorio que el
// flujo real, así que cumple las mismas restricciones (una sola operación en curso por usuario).
import type { Db } from '$lib/server/db/client';
import { immediateTransaction } from '$lib/server/db/tx';
import type { EpochMs } from '$lib/shared/time';
import { insertOperation } from './repository';

export interface OpenOperationInput {
	readonly id: string;
	readonly userId: string;
	readonly appId: string;
	readonly appOperationId: string;
	readonly createdAt?: EpochMs;
}

/** Inserta una operación en curso del usuario y devuelve su id. */
export function openInFlightOperation(db: Db, input: OpenOperationInput): string {
	immediateTransaction(db, (tx) => {
		insertOperation(tx, {
			id: input.id,
			userId: input.userId,
			appId: input.appId,
			appOperationId: input.appOperationId,
			status: 'in_progress',
			...(input.createdAt === undefined ? {} : { createdAt: input.createdAt })
		});
	});
	return input.id;
}
