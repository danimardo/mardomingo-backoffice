// Caché de los parámetros globales (`settings`) de `apps` (BE-FR-61 CA1). Es estado de módulo permitido solo en
// `*.cache.ts` (constitución, «Estado de módulo»). Se guarda por conexión y se invalida al cambiar cualquier
// parámetro, así que la petición siguiente ya ve el valor nuevo.
import type { Db } from '$lib/server/db/client';
import type { SettingKey, SettingValue } from './json-schemas';

const cache = new WeakMap<Db, ReadonlyMap<SettingKey, SettingValue>>();

// Claves de `settings` desconocidas ya avisadas (C-60), por conexión: `readSettings` vuelve a la BD tras cada cambio de un
// parámetro, y el aviso se emite una sola vez por clave mientras viva la conexión (una por proceso en producción).
const warnedUnknownKeys = new WeakMap<Db, Set<string>>();

export function cachedSettings(db: Db): ReadonlyMap<SettingKey, SettingValue> | undefined {
	return cache.get(db);
}

export function storeSettings(db: Db, values: ReadonlyMap<SettingKey, SettingValue>): void {
	cache.set(db, values);
}

export function invalidateSettings(db: Db): void {
	cache.delete(db);
}

/** Marca una clave desconocida como avisada; `true` solo la primera vez para esa conexión (C-60). */
export function firstUnknownSettingWarning(db: Db, key: string): boolean {
	const warned = warnedUnknownKeys.get(db) ?? new Set<string>();
	warnedUnknownKeys.set(db, warned);
	if (warned.has(key)) return false;
	warned.add(key);
	return true;
}
