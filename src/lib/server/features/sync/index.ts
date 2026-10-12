// API pública de `sync` (ARCHITECTURE.md §4). Las rutas y otras funcionalidades solo importan este fichero.
export { seedSync } from './seed';
export { syncDocuments, appDefaults } from './schema';
export type { SyncData } from './domain/document-types';
