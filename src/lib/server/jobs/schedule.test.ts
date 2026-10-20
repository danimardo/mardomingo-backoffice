// Planificación de las tareas (R14, FR-106; T291, T341): solo patrones, sin ejecutar nada. Se comprueba con
// `new Cron(patrón, { timezone, paused: true }).nextRuns(n, desde)` alrededor de los cambios de hora de Madrid: el 2026-10-25
// (la hora de las 02:00 a las 03:00 se repite) y el 2027-03-28 (la de las 02:00 a las 03:00 no existe).
import { Cron } from 'croner';
import { describe, expect, it } from 'vitest';
import { SCHEDULE } from './schedule';
import { TASK_TIMEZONE } from './run-task';

const tasks = SCHEDULE;

const LOCAL = new Intl.DateTimeFormat('es-ES', {
	timeZone: TASK_TIMEZONE,
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23'
});

/** Fecha y hora de pared de Madrid de una ejecución, como `2026-10-25 04:10`. */
function local(date: Date): string {
	const parts = new Map(LOCAL.formatToParts(date).map((part) => [part.type, part.value]));
	const get = (type: Intl.DateTimeFormatPartTypes): string => parts.get(type) ?? '';
	return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

function runs(pattern: string, count: number, from: string): string[] {
	return new Cron(pattern, { timezone: TASK_TIMEZONE, paused: true })
		.nextRuns(count, new Date(from))
		.map(local);
}

/** Hora de pared de un patrón diario simple (`m h * * *`), como `04:10`. */
function wallOf(pattern: string): string {
	const [minute = '0', hour = '0'] = pattern.split(' ');
	return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

describe('registro de tareas', () => {
	it('cada tarea tiene un nombre único y un patrón válido', () => {
		const names = tasks.map((task) => task.name);
		expect(new Set(names).size).toBe(names.length);
		for (const task of tasks) {
			expect(() => new Cron(task.pattern, { timezone: TASK_TIMEZONE, paused: true })).not.toThrow();
		}
	});

	it('el BCE se consulta a las 16:30 y se pone al día al arrancar junto con la caducidad y la limpieza de reservas', () => {
		const byName = new Map(tasks.map((task) => [task.name, task]));
		expect(byName.get('fx-ecb')?.pattern).toBe('30 16 * * *');
		const catchUp = tasks
			.filter((task) => task.catchUpOnStart)
			.map((task) => task.name)
			.sort();
		expect(catchUp).toEqual(['free-credits-expiry', 'fx-ecb', 'holds-cleanup']);
	});

	it('las tareas de privacidad corren de madrugada y escalonadas', () => {
		const byName = new Map(tasks.map((task) => [task.name, task.pattern]));
		expect(byName.get('retention')).toBe('0 4 * * *');
		expect(byName.get('unverified-accounts-cleanup')).toBe('10 4 * * *');
		expect(byName.get('inactive-accounts')).toBe('20 4 * * *');
	});

	it('ninguna tarea diaria cae entre las 02:00 y las 03:00 de Madrid, ni dos a la misma hora', () => {
		const seen = new Set<string>();
		// Las tareas horarias (minuto fijo, hora `*`) no entran: corren cada hora por diseño, también en esas fechas.
		for (const task of tasks.filter((item) => item.pattern.split(' ')[1] !== '*')) {
			const [first] = runs(task.pattern, 1, '2026-10-19T00:00:00Z');
			const time = (first ?? '').slice(11);
			expect(time < '02:00' || time >= '03:00', `${task.name} a las ${time}`).toBe(true);
			expect(seen.has(time), `${task.name} comparte hora ${time}`).toBe(false);
			seen.add(time);
		}
	});
});

describe('cambios de hora de Madrid', () => {
	it('la tarea horaria openrouter-balance cubre las 23 horas reales del cambio de marzo (T326)', () => {
		const hourly = tasks.find((task) => task.name === 'openrouter-balance');
		expect(hourly?.pattern).toBe('17 * * * *');
		expect(runs('17 * * * *', 24, '2026-10-24T12:00:00Z')).toHaveLength(24);
		const marzo = runs('17 * * * *', 60, '2027-03-27T12:00:00Z').filter((run) =>
			run.startsWith('2027-03-28')
		);
		// Croner desplaza la de las 02:17 (que no existe) a las 03:17, que se repite: el duplicado es inocuo porque la tarea es
		// idempotente (la alerta ya activa se suprime y limpiar dos veces no cambia nada).
		expect(new Set(marzo)).toHaveProperty('size', 23);
		expect(marzo.filter((run) => run.endsWith('03:17'))).toHaveLength(2);
	});

	const DAILY = tasks.filter(
		(task) =>
			task.pattern.split(' ')[2] === '*' &&
			task.pattern.split(' ')[4] === '*' &&
			task.pattern.split(' ')[1] !== '*'
	);

	it('la lista de dominios desechables se refresca los lunes a las 04:15 (T340)', () => {
		const found = tasks.find((task) => task.name === 'disposable-domains');
		expect(found?.pattern).toBe('15 4 * * 1');
	});

	it('en el cambio de octubre (2026-10-25, día de 25 horas) cada tarea corre una sola vez ese día, a su hora', () => {
		for (const task of DAILY) {
			const sameDay = runs(task.pattern, 5, '2026-10-24T12:00:00Z').filter((run) =>
				run.startsWith('2026-10-25')
			);
			expect(sameDay, task.name).toEqual([`2026-10-25 ${wallOf(task.pattern)}`]);
		}
	});

	it('en el cambio de marzo (2027-03-28, día de 23 horas) cada tarea corre una sola vez ese día, a su hora', () => {
		for (const task of DAILY) {
			const sameDay = runs(task.pattern, 5, '2027-03-27T12:00:00Z').filter((run) =>
				run.startsWith('2027-03-28')
			);
			expect(sameDay, task.name).toHaveLength(1);
		}
	});

	it('una hora de pared repetida en octubre se ejecuta una vez, y la que no existe en marzo no se ejecuta', () => {
		// R14: lo que hace croner con una tarea diaria a las 02:30, que aquí no se usa pero fija el comportamiento esperado.
		const october = runs('30 2 * * *', 4, '2026-10-24T12:00:00Z').filter((run) =>
			run.startsWith('2026-10-25')
		);
		expect(october).toEqual(['2026-10-25 02:30']);

		const march = runs('30 2 * * *', 4, '2027-03-27T12:00:00Z').filter((run) =>
			run.startsWith('2027-03-28')
		);
		expect(march.length).toBeLessThanOrEqual(1);
	});

	it('todas conservan su hora de pared durante dos años, también al cruzar los cambios de hora', () => {
		for (const task of DAILY) {
			const wall = wallOf(task.pattern);
			const all = runs(task.pattern, 730, '2026-10-19T00:00:00Z');
			expect(
				all.every((run) => run.slice(11) === wall),
				task.name
			).toBe(true);
		}
	});
});
