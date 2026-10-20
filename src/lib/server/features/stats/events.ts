// Catálogo de eventos de `stats` (contracts/log-events.md 3.12; L14). Solo contadores y el proveedor, nunca importes de cuentas.
import type { LogEventMeta } from '$lib/server/logging/events';

export interface StatsLogFields {
	'stats.downloads.fetched': { provider: 'github'; count: number };
	'stats.downloads.fetch_failed': { provider: 'github'; err: unknown };
	'pricing.reference.recomputed': { count: number; status: 'auto' | 'manual' };
}

export const STATS_LOG_EVENTS = Object.freeze({
	'stats.downloads.fetched': { level: 'info', msg: 'Descargas de GitHub Releases obtenidas' },
	'stats.downloads.fetch_failed': { level: 'warn', msg: 'No se pudieron obtener las descargas' },
	'pricing.reference.recomputed': { level: 'info', msg: 'Precio orientativo recalculado' }
} as const satisfies Record<keyof StatsLogFields, LogEventMeta>);
