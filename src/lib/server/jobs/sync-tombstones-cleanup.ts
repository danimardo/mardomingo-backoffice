// Tarea `sync-tombstones-cleanup` (FR-064, H-27; T338): elimina cada noche las marcas de borrado caducadas de los documentos
// de sincronización. La regla y sus casos están probados en `features/sync/domain/tombstones.test.ts`, y el servicio, en
// `features/sync/tombstones-cleanup.int.test.ts`.
import type { SyncDeps } from '$lib/server/features/sync';
import { purgeTombstones } from '$lib/server/features/sync';

export function runTombstonesCleanup(sync: SyncDeps): number {
	return purgeTombstones(sync);
}
