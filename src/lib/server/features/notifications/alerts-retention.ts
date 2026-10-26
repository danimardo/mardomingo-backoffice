// Retención de `alerts_state` (data-model §6; T293): las claves que llevan un usuario o una fecha (`flagged:…`,
// `global_brake:…`, `ledger_mismatch:…`) se borran pasados 30 días sin cambios. Las claves fijas (`fx_stale`, `model:…`) son el
// estado vivo de una condición y no se tocan.
import { and, lt, or, like } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import { immediateTransaction } from '$lib/server/db/tx';
import type { EpochMs } from '$lib/shared/time';
import { alertsState } from './schema';

export function purgeAlertKeysBefore(deps: { readonly db: Db }, before: EpochMs): number {
	return immediateTransaction(
		deps.db,
		(tx) =>
			tx
				.delete(alertsState)
				.where(
					and(
						lt(alertsState.updatedAt, before),
						or(
							like(alertsState.key, 'flagged:%'),
							like(alertsState.key, 'global_brake:%'),
							like(alertsState.key, 'ledger_mismatch:%')
						)
					)
				)
				.run().changes
	);
}
