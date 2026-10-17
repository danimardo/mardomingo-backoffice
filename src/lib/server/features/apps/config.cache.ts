// Caché de los parámetros globales (`settings`) de `apps` (BE-FR-61 CA1). Es estado de módulo permitido solo en
// `*.cache.ts` (constitución, «Estado de módulo»). Se guarda por conexión y se invalida al cambiar cualquier
// parámetro, así que la petición siguiente ya ve el valor nuevo.
import type { Db } from '$lib/server/db/client';
import type { SettingKey, SettingValue } from './json-schemas';

const cache = new WeakMap<Db, ReadonlyMap<SettingKey, SettingValue>>();

export function cachedSettings(db: Db): ReadonlyMap<SettingKey, SettingValue> | undefined {
	return cache.get(db);
}

export function storeSettings(db: Db, values: ReadonlyMap<SettingKey, SettingValue>): void {
	cache.set(db, values);
}

export function invalidateSettings(db: Db): void {
	cache.delete(db);
}
