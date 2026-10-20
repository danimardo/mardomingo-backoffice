// Cuándo corre cada tarea (R14, FR-106; T291, T341). Solo datos: sin dependencias, para probar la planificación con
// `new Cron(patrón, { timezone, paused: true }).nextRuns(n, desde)` sin montar la aplicación.
//
// Horas en Europe/Madrid, escalonadas desde las 04:00 para no competir por el bloqueo de escritura de SQLite, y ninguna diaria entre
// las 02:00 y las 03:00 (los cambios de hora, R14). El BCE publica hacia las 16:00, así que se consulta a las 16:30. Las tareas que
// deben ponerse al día tras un reinicio (croner no guarda estado) se lanzan también al arrancar.
//
// Semanal: `disposable-domains` los lunes a las 04:15 (T340). Pendiente: `sync-tombstones-cleanup`, que no aplica (T338).

/** Tareas ya programadas. */
export type ScheduledTaskName =
	| 'retention'
	| 'unverified-accounts-cleanup'
	| 'inactive-accounts'
	| 'free-credits-expiry'
	| 'holds-cleanup'
	| 'ledger-check'
	| 'adjustment-keys-cleanup'
	| 'openrouter-balance'
	| 'price-references'
	| 'release-downloads'
	| 'models-refresh'
	| 'fx-ecb'
	| 'disposable-domains';

export interface TaskSchedule {
	readonly name: ScheduledTaskName;
	/** Patrón cron de croner, interpretado en Europe/Madrid. */
	readonly pattern: string;
	/** Se lanza también al arrancar, tras las migraciones. */
	readonly catchUpOnStart: boolean;
}

export const SCHEDULE: readonly TaskSchedule[] = Object.freeze([
	{ name: 'retention', pattern: '0 4 * * *', catchUpOnStart: false },
	{ name: 'unverified-accounts-cleanup', pattern: '10 4 * * *', catchUpOnStart: false },
	{ name: 'inactive-accounts', pattern: '20 4 * * *', catchUpOnStart: false },
	{ name: 'free-credits-expiry', pattern: '30 4 * * *', catchUpOnStart: true },
	{ name: 'holds-cleanup', pattern: '40 4 * * *', catchUpOnStart: true },
	{ name: 'ledger-check', pattern: '45 4 * * *', catchUpOnStart: false },
	{ name: 'adjustment-keys-cleanup', pattern: '55 4 * * *', catchUpOnStart: false },
	{ name: 'openrouter-balance', pattern: '17 * * * *', catchUpOnStart: false },
	{ name: 'price-references', pattern: '50 4 * * *', catchUpOnStart: false },
	{ name: 'release-downloads', pattern: '0 5 * * *', catchUpOnStart: false },
	{ name: 'models-refresh', pattern: '10 5 * * *', catchUpOnStart: false },
	{ name: 'fx-ecb', pattern: '30 16 * * *', catchUpOnStart: true },
	{ name: 'disposable-domains', pattern: '15 4 * * 1', catchUpOnStart: false }
]);
