// Caché del esquema de sincronización por app (BE-FR-39; T215). Es estado de módulo permitido solo en `*.cache.ts`. Cada
// entrada guarda la fecha de modificación de la app con la que se leyó: si la app cambió, la entrada ya no sirve y se relee.
import type { SyncSchema } from './domain/schema-types';

interface Entry {
	readonly updatedAt: number;
	readonly schema: SyncSchema;
}

const byApp = new Map<string, Entry>();

/** El esquema cacheado de la app, solo si se leyó con la misma fecha de modificación. */
export function cachedSyncSchema(appId: string, updatedAt: number): SyncSchema | undefined {
	const entry = byApp.get(appId);
	return entry !== undefined && entry.updatedAt === updatedAt ? entry.schema : undefined;
}

export function storeSyncSchema(appId: string, updatedAt: number, schema: SyncSchema): void {
	byApp.set(appId, { updatedAt, schema });
}
