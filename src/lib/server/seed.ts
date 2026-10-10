// Datos iniciales del sistema (T080): parámetros, app `secretario` y paquetes. Se aplica en `init` después de migrar y
// es idempotente: dos arranques dejan la misma base de datos. Lo llama solo `hooks.server.ts`.
import type { Clock } from './adapters/clock/clock';
import type { Db } from './db/client';
import { immediateTransaction } from './db/tx';
import { seedApps } from './features/apps';
import { seedPayments } from './features/payments';

export function seedDefaults(db: Db, clock: Clock): void {
	immediateTransaction(db, (tx) => {
		const now = clock.now();
		seedApps(tx, now);
		seedPayments(tx, now);
	});
}
