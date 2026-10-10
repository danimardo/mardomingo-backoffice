// Transacciones de escritura. `BEGIN IMMEDIATE` toma el bloqueo de escritura al empezar, así que dos
// escrituras concurrentes se serializan en vez de fallar a mitad (constitución, principio VI; R03).
// El callback es síncrono: better-sqlite3 no admite `await` dentro de una transacción.
import type { Db } from './client';

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export function immediateTransaction<T>(db: Db, work: (tx: Tx) => T): T {
	return db.transaction(work, { behavior: 'immediate' });
}
