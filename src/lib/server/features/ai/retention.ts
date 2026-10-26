// Retención de `ai_operations` (BE-FR-83; data-model §6; T293). Pasados 24 meses, la operación se conserva para las
// estadísticas pero deja de estar ligada a la persona: `user_id`, `session_id`, `idempotency_key` y `provider_generation_id`
// pasan a nulo. Sin ellos no hay forma de volver a la cuenta ni de consultar al proveedor por esa generación.
import { and, isNotNull, lt, or } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import { immediateTransaction } from '$lib/server/db/tx';
import type { EpochMs } from '$lib/shared/time';
import { aiOperations } from './schema';

/** Anonimiza las operaciones anteriores al corte. Devuelve cuántas filas cambió; repetirlo no cambia nada. */
export function anonymizeOperationsBefore(deps: { readonly db: Db }, before: EpochMs): number {
	return immediateTransaction(
		deps.db,
		(tx) =>
			tx
				.update(aiOperations)
				.set({ userId: null, sessionId: null, idempotencyKey: null, providerGenerationId: null })
				.where(
					and(
						lt(aiOperations.createdAt, before),
						or(
							isNotNull(aiOperations.userId),
							isNotNull(aiOperations.sessionId),
							isNotNull(aiOperations.idempotencyKey),
							isNotNull(aiOperations.providerGenerationId)
						)
					)
				)
				.run().changes
	);
}
