// API pública de `sync` (ARCHITECTURE.md §4). Las rutas y otras funcionalidades solo importan este fichero.
export { seedSync } from './seed';
export { syncDocuments, appDefaults } from './schema';
export { syncedAppIds } from './synced-apps';
export type { SyncData } from './domain/document-types';
export {
	parseIfMatch,
	PutSyncBody,
	GetSyncResponse,
	PutSyncResponse,
	DefaultsResponse
} from './contract';
export {
	applyCopyAsDefaults,
	getDefaults,
	getSyncDocument,
	previewCopyAsDefaults,
	putSyncDocument,
	updateDefaults,
	type SyncDeps
} from './service';
export { SYNC_LOG_EVENTS, type SyncLogFields } from './events';
