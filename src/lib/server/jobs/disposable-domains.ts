// Tarea `disposable-domains` (BE-FR-11.2, FR-019; T340): descarga semanal de la lista pública de dominios desechables. Si la
// descarga falla o la lista no es válida, se registra y se conserva la lista anterior.
import type { Db } from '$lib/server/db/client';
import {
	fetchBlocklist,
	DISPOSABLE_BLOCKLIST_URL
} from '$lib/server/adapters/disposable-domains/blocklist';
import { applyDisposableDomains } from '$lib/server/features/accounts';
import type { Logger } from '$lib/server/logging/logger';
import type { Clock } from '$lib/server/adapters/clock/clock';
import { toEpochMs } from '$lib/shared/time';

/** Devuelve cuántos dominios hay en la lista tras el refresco, o 0 si no se actualizó. */
export async function runDisposableDomains(deps: {
	readonly db: Db;
	readonly logger: Logger;
	readonly clock: Clock;
	readonly url?: string;
}): Promise<number> {
	const fetched = await fetchBlocklist(deps.url ?? DISPOSABLE_BLOCKLIST_URL);
	if (fetched.status === 'error') {
		deps.logger.emit('accounts.disposable_domains.refresh_failed', {
			httpStatus: fetched.httpStatus ?? 0
		});
		return 0;
	}
	return applyDisposableDomains(deps, fetched.domains, toEpochMs(deps.clock.now()));
}
