// Migraciones al arrancar (R03; constitución, «Datos y almacenamiento»). Antes de aplicar migraciones
// pendientes se guarda una copia de la BD en `backupDir` y se conservan solo las últimas `keepBackups`.
// Si el fichero de journal no existe (todavía no hay esquema), no hay nada que aplicar.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { z } from 'zod';
import type { Logger } from '$lib/server/logging/logger';
import type { Db } from './client';

const journalSchema = z.object({
	entries: z.array(z.object({ tag: z.string(), when: z.number() }))
});

export interface MigrateOptions {
	readonly sqlite: Database.Database;
	readonly db: Db;
	readonly migrationsFolder: string;
	/** Ruta del fichero de BD. `:memory:` no admite copia previa. */
	readonly databasePath: string;
	readonly backupDir: string;
	readonly keepBackups: number;
	readonly version: string;
	readonly logger: Logger;
}

/** Aplica las migraciones pendientes y devuelve cuántas había. Lanza si alguna falla. */
export async function migrateDatabase(options: MigrateOptions): Promise<number> {
	const journalPath = join(options.migrationsFolder, 'meta', '_journal.json');
	const pending = countPending(options.sqlite, journalPath);
	const started = performance.now();

	try {
		if (pending > 0 && options.databasePath !== ':memory:') {
			await backupBeforeMigrate(options);
		}
		if (existsSync(journalPath)) {
			migrate(options.db, { migrationsFolder: options.migrationsFolder });
		}
	} catch (error) {
		options.logger.emit('app.db.migration_failed', { err: error });
		throw error;
	}

	options.logger.emit('app.db.migrated', {
		count: pending,
		durationMs: Math.round(performance.now() - started)
	});
	return pending;
}

function countPending(sqlite: Database.Database, journalPath: string): number {
	if (!existsSync(journalPath)) return 0;
	const journal = journalSchema.parse(JSON.parse(readFileSync(journalPath, 'utf8')));
	return Math.max(0, journal.entries.length - appliedCount(sqlite));
}

function appliedCount(sqlite: Database.Database): number {
	const table = sqlite
		.prepare(
			"SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'"
		)
		.get();
	if (table === undefined) return 0;
	const row = sqlite.prepare('SELECT COUNT(*) AS total FROM __drizzle_migrations').get();
	return z.object({ total: z.number() }).parse(row).total;
}

async function backupBeforeMigrate(options: MigrateOptions): Promise<void> {
	mkdirSync(options.backupDir, { recursive: true });
	const target = join(options.backupDir, `${options.version}.db`);
	await options.sqlite.backup(target);
	pruneBackups(options.backupDir, options.keepBackups);
}

function pruneBackups(dir: string, keep: number): void {
	const backups = readdirSync(dir)
		.filter((name) => name.endsWith('.db'))
		.map((name) => ({ path: join(dir, name), modified: statSync(join(dir, name)).mtimeMs }))
		.sort((a, b) => b.modified - a.modified);
	for (const stale of backups.slice(keep)) {
		unlinkSync(stale.path);
	}
}
