// Envoltorio de las tareas con `trigger()` de croner (R14, FR-106; T291): el ciclo de vida se registra una sola vez, un error
// produce un solo registro y nunca se relanza, las tareas que se ponen al día se lanzan al arrancar y `protect` evita
// solapar dos ejecuciones de la misma tarea.
import { afterEach, describe, expect, it } from 'vitest';
import { createFakeLogger } from '../../../../tests/builders/fake-logger';
import { eventsNamed } from '../../../../tests/builders/fake-logger';
import { runTask, startTasks, type RunningTasks, type Task } from './run-task';

let running: RunningTasks | undefined;

afterEach(() => {
	running?.stop();
	running = undefined;
});

/** Espera a que una condición se cumpla, para no depender de cuánto tarde el temporizador de croner. */
async function until(condition: () => boolean): Promise<void> {
	for (let attempt = 0; attempt < 200 && !condition(); attempt += 1) {
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	expect(condition()).toBe(true);
}

describe('runTask', () => {
	it('registra el inicio, el final y el recuento una sola vez', async () => {
		const logger = createFakeLogger();

		const ok = await runTask(logger, { name: 'retention', run: () => 7 });

		expect(ok).toBe(true);
		expect(eventsNamed(logger, 'app.task.started').map((event) => event.fields)).toEqual([
			{ task: 'retention' }
		]);
		const completed = eventsNamed(logger, 'app.task.completed');
		expect(completed).toHaveLength(1);
		expect(completed[0]?.fields).toMatchObject({ task: 'retention', count: 7 });
		expect(completed[0]?.fields).toHaveProperty('durationMs');
		expect(eventsNamed(logger, 'app.task.failed')).toHaveLength(0);
	});

	it('un error produce un único registro de fallo y no se relanza', async () => {
		const logger = createFakeLogger();
		const boom = new Error('el proveedor no responde');

		const ok = await runTask(logger, {
			name: 'fx-ecb',
			run: () => Promise.reject(boom)
		});

		expect(ok).toBe(false);
		const failed = eventsNamed(logger, 'app.task.failed');
		expect(failed).toHaveLength(1);
		expect(failed[0]?.fields).toMatchObject({ task: 'fx-ecb', err: boom });
		expect(eventsNamed(logger, 'app.task.completed')).toHaveLength(0);
	});

	it('también recoge un fallo síncrono de la tarea', async () => {
		const logger = createFakeLogger();

		const ok = await runTask(logger, {
			name: 'retention',
			run: () => {
				throw new Error('síncrono');
			}
		});

		expect(ok).toBe(false);
		expect(eventsNamed(logger, 'app.task.failed')).toHaveLength(1);
	});
});

describe('startTasks', () => {
	function task(name: Task['name'], run: Task['run'], catchUpOnStart = false): Task {
		return { name, pattern: '0 4 * * *', catchUpOnStart, run };
	}

	it('lanza al arrancar solo las que deben ponerse al día', async () => {
		const logger = createFakeLogger();
		const ran: string[] = [];
		running = startTasks(logger, [
			task('fx-ecb', () => ran.push('fx-ecb'), true),
			task('retention', () => ran.push('retention'))
		]);

		await until(() => ran.length > 0);

		expect(ran).toEqual(['fx-ecb']);
		expect([...running.jobs.keys()].sort()).toEqual(['fx-ecb', 'retention']);
	});

	it('trigger() ejecuta la tarea programada con el mismo envoltorio', async () => {
		const logger = createFakeLogger();
		running = startTasks(logger, [task('retention', () => 3)]);

		await running.jobs.get('retention')?.trigger();

		expect(eventsNamed(logger, 'app.task.completed')[0]?.fields).toMatchObject({
			task: 'retention',
			count: 3
		});
	});

	it('mientras una tarea corre, croner la da por ocupada: es lo que `protect` usa para no solapar la siguiente programada', async () => {
		const logger = createFakeLogger();
		let release: () => void = () => undefined;
		let started = false;
		running = startTasks(logger, [
			task('retention', async () => {
				started = true;
				await new Promise<void>((resolve) => {
					release = resolve;
				});
				return 0;
			})
		]);
		const job = running.jobs.get('retention');
		expect(job?.isBusy()).toBe(false);

		const run = job?.trigger();
		await until(() => started);
		expect(job?.isBusy()).toBe(true);
		release();
		await run;

		expect(job?.isBusy()).toBe(false);
	});

	it('stop() detiene todas las tareas programadas', () => {
		const logger = createFakeLogger();
		const tasks = startTasks(logger, [task('retention', () => 0), task('fx-ecb', () => 0)]);

		tasks.stop();

		for (const job of tasks.jobs.values()) expect(job.isStopped()).toBe(true);
	});
});
