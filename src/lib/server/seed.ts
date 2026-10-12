// Datos iniciales del sistema (T080, T093, T096): parámetros, app `secretario`, paquetes, versiones provisionales de los
// documentos legales y lista de dominios desechables. Se aplica en `init` después de migrar y es idempotente: dos
// arranques dejan la misma base de datos. Lo llama solo `hooks.server.ts` (y el global-setup de las pruebas).
import type { Clock } from './adapters/clock/clock';
import type { Db } from './db/client';
import { immediateTransaction } from './db/tx';
import { seedDisposableDomains } from './features/accounts';
import { seedApps } from './features/apps';
import { seedSync } from './features/sync';
import { seedLegalDocuments } from './features/legal';
import { seedPayments } from './features/payments';
import type { IdGenerator } from './shared/ids';

export function seedDefaults(db: Db, clock: Clock, ids: IdGenerator): void {
	immediateTransaction(db, (tx) => {
		const now = clock.now();
		seedApps(tx, now);
		seedSync(tx, now);
		seedPayments(tx, now);
		seedLegalDocuments(tx, () => ids('ldoc'), now);
		seedDisposableDomains(tx, now);
	});
}
