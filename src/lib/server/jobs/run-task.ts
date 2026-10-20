// Envoltorio y programación de las tareas periódicas (R14, FR-106; T291). Cada tarea es una función que recibe sus dependencias ya
// enlazadas y devuelve cuántos elementos trató; aquí solo se mide, se registra y se programa con croner:
//
// - `runTask` registra el inicio (`debug`), el final (`info`, con duración y recuento) o el fallo (`error`) una sola vez y nunca
//   relanza: una tarea que falla no tumba el proceso ni las demás tareas.
// - `startTasks` programa cada tarea con su patrón en Europe/Madrid. `protect` evita que una ejecución empiece mientras la
//   anterior de la misma tarea sigue en marcha, y `catch` es el último recurso ante un fallo del propio croner.
// - Las tareas que deben ponerse al día tras un reinicio (croner no guarda estado) se lanzan también al arrancar.
import { Cron } from 'croner';
import type { Logger } from '$lib/server/logging/logger';

export const TASK_TIMEZONE = 'Europe/Madrid';

/** Valores de `task` de `app.task.*` (contracts/log-events.md 2.1). */
export type TaskName =
	| 'openrouter-balance'
	| 'free-credits-expiry'
	| 'ledger-check'
	| 'models-refresh'
	| 'price-references'
	| 'sync-tombstones-cleanup'
	| 'unverified-accounts-cleanup'
	| 'retention'
	| 'holds-cleanup'
	| 'fx-ecb'
	| 'inactive-accounts'
	| 'release-downloads'
	| 'disposable-domains';

export interface Task {
	readonly name: TaskName;
	/** Patrón cron de croner, interpretado en Europe/Madrid. */
	readonly pattern: string;
	/** Se lanza también al arrancar, tras las migraciones (BCE, caducidad, limpieza de reservas). */
	readonly catchUpOnStart: boolean;
	/** Hace el trabajo y devuelve cuántos elementos trató. Puede lanzar: el envoltorio lo registra. */
	readonly run: () => Promise<number> | number;
}

/** Ejecuta una tarea una vez: registra su ciclo de vida y nunca relanza. Devuelve si terminó bien. */
export async function runTask(logger: Logger, task: Pick<Task, 'name' | 'run'>): Promise<boolean> {
	const started = performance.now();
	logger.emit('app.task.started', { task: task.name });
	try {
		const result = await task.run();
		logger.emit('app.task.completed', {
			task: task.name,
			durationMs: Math.round(performance.now() - started),
			count: result
		});
		return true;
	} catch (error) {
		logger.emit('app.task.failed', {
			task: task.name,
			durationMs: Math.round(performance.now() - started),
			err: error
		});
		return false;
	}
}

export interface RunningTasks {
	/** Las tareas programadas, por nombre (para `trigger()` y para las pruebas de programación). */
	readonly jobs: ReadonlyMap<TaskName, Cron>;
	/** Para todas las tareas programadas (en `sveltekit:shutdown`). */
	stop(): void;
}

/** Programa las tareas y lanza al arrancar las que deben ponerse al día. No espera a que terminen. */
export function startTasks(logger: Logger, tasks: readonly Task[]): RunningTasks {
	const jobs = new Map<TaskName, Cron>();
	for (const task of tasks) {
		const job = new Cron(
			task.pattern,
			{
				name: task.name,
				timezone: TASK_TIMEZONE,
				protect: () => {
					logger.emit('app.task.overlapped', { task: task.name });
				},
				// Último recurso: `runTask` ya captura los fallos de la tarea, así que esto solo ve un fallo del propio envoltorio.
				catch: (error) => {
					logger.emit('app.task.failed', { task: task.name, durationMs: 0, err: error });
				},
				unref: false
			},
			async () => {
				await runTask(logger, task);
			}
		);
		jobs.set(task.name, job);
	}
	// `trigger()` respeta `protect`: si la ejecución programada coincide, no se solapa.
	for (const task of tasks) {
		if (task.catchUpOnStart) void jobs.get(task.name)?.trigger();
	}
	return {
		jobs,
		stop: () => {
			for (const job of jobs.values()) job.stop();
		}
	};
}
