// Catálogo de eventos de `stats` (contracts/log-events.md; L14). Solo contadores y nombres de paso, nunca importes de cuentas.
import type { LogEventMeta } from '$lib/server/logging/events';

export interface StatsLogFields {
	'stats.daily_job.started': Record<string, never>;
	'stats.daily_job.finished': { failed: number };
	'stats.daily_job.step_failed': { step: string; err: unknown };
}

export const STATS_LOG_EVENTS = Object.freeze({
	'stats.daily_job.started': { level: 'info', msg: 'Tarea diaria iniciada' },
	'stats.daily_job.finished': { level: 'info', msg: 'Tarea diaria terminada' },
	'stats.daily_job.step_failed': { level: 'error', msg: 'Paso de la tarea diaria fallido' }
} as const satisfies Record<keyof StatsLogFields, LogEventMeta>);
