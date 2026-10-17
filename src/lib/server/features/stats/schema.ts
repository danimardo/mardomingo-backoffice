// Tablas de la funcionalidad `stats` (data-model.md 2.14; T299). Solo lectura de las demás: `release_downloads` la llena la
// tarea diaria de L14 con el contador de descargas de cada app, y la lee el embudo de W45.
import { check, primaryKey, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { civilDate, civilDateCheck, epochMs } from '$lib/server/db/columns';
import { apps } from '../apps/schema';

export const releaseDownloads = sqliteTable(
	'release_downloads',
	{
		appId: text('app_id')
			.notNull()
			.references(() => apps.id, { onDelete: 'restrict' }),
		day: civilDate('day').notNull(),
		cumulativeDownloads: integer('cumulative_downloads').notNull(),
		downloads: integer('downloads'),
		fetchedAt: epochMs('fetched_at').notNull()
	},
	(table) => [
		primaryKey({ columns: [table.appId, table.day] }),
		check('release_downloads_day_format', civilDateCheck(table.day.name)),
		check(
			'release_downloads_cumulative_non_negative',
			sql`${sql.identifier('cumulative_downloads')} >= 0`
		),
		check(
			'release_downloads_downloads_non_negative',
			sql`${sql.identifier('downloads')} IS NULL OR ${sql.identifier('downloads')} >= 0`
		)
	]
);

// Registro de las ejecuciones de la tarea diaria (L14; decisión del propietario: bloqueo en base de datos). Una fila por día civil:
// la clave primaria impide que dos procesos ejecuten el mismo día, y una fila sin `finished_at` marca una ejecución interrumpida.
export const dailyJobRuns = sqliteTable(
	'daily_job_runs',
	{
		day: civilDate('day').primaryKey(),
		startedAt: epochMs('started_at').notNull(),
		finishedAt: epochMs('finished_at'),
		outcome: text('outcome', { enum: ['ok', 'partial'] })
	},
	(table) => [check('daily_job_runs_day_format', civilDateCheck(table.day.name))]
);
