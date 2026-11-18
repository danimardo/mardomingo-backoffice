// Aceptación de documentos pendientes desde la web (W18; BE-FR-70/CA1–CA2; T277). Una transacción `BEGIN IMMEDIATE`: o se registran
// todas las versiones vigentes o no se escribe nada. `appId` es el id de la app cuando acepta desde la API y `null` en la web. La aceptación es idempotente por versión.
import { immediateTransaction } from '$lib/server/db/tx';
import { recordAcceptances, type AcceptanceInput, type LegalDeps } from './service';
import type { EpochMs } from '$lib/shared/time';

export function acceptDocuments(
	deps: LegalDeps,
	input: {
		readonly userId: string;
		readonly appId: string | null;
		readonly ip: string | null;
		readonly now: EpochMs;
		readonly accepted: readonly AcceptanceInput[];
	}
): number {
	const count = immediateTransaction(deps.db, (tx) => recordAcceptances(tx, deps, input));
	deps.logger.emit('legal.acceptance.recorded', { count: input.accepted.length });
	return count;
}
