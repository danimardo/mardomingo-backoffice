// _Seed_ de los paquetes de créditos (BE-FR-23; T080). Los valores por defecto los lee de `apps` a través de su API
// pública. Idempotente: un paquete ya existente no se toca.
import type { Tx } from '$lib/server/db/tx';
import { DEFAULT_PACKS } from '$lib/server/features/apps';
import { toEurCents, toPpm } from '$lib/shared/money';
import type { EpochMs } from '$lib/shared/time';
import { packs } from './schema';

export function seedPayments(tx: Tx, now: EpochMs): void {
	for (const pack of DEFAULT_PACKS) {
		tx.insert(packs)
			.values({
				id: pack.id,
				name: pack.name,
				priceEurCents: toEurCents(pack.priceEurCents),
				bonusPpm: toPpm(pack.bonusPpm),
				active: true,
				sortOrder: pack.sortOrder,
				createdAt: now,
				updatedAt: now
			})
			.onConflictDoNothing()
			.run();
	}
}
