// Refresco de la lista de dominios desechables (BE-FR-11.2; T340). Añade los dominios nuevos y conserva los que ya estaban: la
// lista solo crece desde la fuente, así que una lectura parcial no deja sin bloquear un dominio que ya se bloqueó.
import type { Db } from '$lib/server/db/client';
import { immediateTransaction } from '$lib/server/db/tx';
import type { Logger } from '$lib/server/logging/logger';
import type { EpochMs } from '$lib/shared/time';
import { insertDisposableDomains } from './repository';

export function applyDisposableDomains(
	deps: { readonly db: Db; readonly logger: Logger },
	domains: readonly string[],
	now: EpochMs
): number {
	immediateTransaction(deps.db, (tx) => {
		insertDisposableDomains(tx, domains, now);
	});
	deps.logger.emit('accounts.disposable_domains.refreshed', { count: domains.length });
	return domains.length;
}
