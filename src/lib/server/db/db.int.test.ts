// Pruebas de integración de la BD (T-INT, R03): pragmas reales, transacción que revierte y migraciones sobre
// una BD vacía con copia previa. Cada prueba usa su propio directorio temporal.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	createFakeLogger,
	eventsNamed,
	type FakeLogger
} from '../../../../tests/builders/fake-logger';
import { openDatabase } from './client';
import { migrateDatabase } from './migrate';
import { immediateTransaction } from './tx';

let dir: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'mdm-db-'));
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

/** Carpeta de migraciones con una sola migración en el formato de drizzle-kit. */
function writeMigrations(folder: string, sql: string): void {
	mkdirSync(join(folder, 'meta'), { recursive: true });
	writeFileSync(
		join(folder, 'meta', '_journal.json'),
		JSON.stringify({
			version: '7',
			dialect: 'sqlite',
			entries: [
				{ idx: 0, version: '6', when: 1_700_000_000_000, tag: '0000_init', breakpoints: true }
			]
		})
	);
	writeFileSync(join(folder, '0000_init.sql'), sql);
}

describe('openDatabase', () => {
	it('aplica WAL, claves foráneas, espera de 5 s y synchronous NORMAL', () => {
		const { sqlite } = openDatabase(join(dir, 'app.db'));

		expect(sqlite.pragma('journal_mode', { simple: true })).toBe('wal');
		expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
		expect(sqlite.pragma('busy_timeout', { simple: true })).toBe(5000);
		expect(sqlite.pragma('synchronous', { simple: true })).toBe(1);
		sqlite.close();
	});
});

describe('immediateTransaction', () => {
	it('revierte la escritura si el trabajo lanza un error', () => {
		const { sqlite, db } = openDatabase(join(dir, 'app.db'));
		sqlite.exec('CREATE TABLE notas (texto TEXT NOT NULL)');

		expect(() =>
			immediateTransaction(db, (tx) => {
				tx.run(sql`INSERT INTO notas (texto) VALUES ('primera')`);
				throw new Error('fallo a mitad de la transacción');
			})
		).toThrow('fallo a mitad de la transacción');

		expect(sqlite.prepare('SELECT COUNT(*) AS total FROM notas').get()).toEqual({ total: 0 });
		sqlite.close();
	});
});

describe('migrateDatabase', () => {
	it('aplica las migraciones pendientes, guarda una copia previa y registra el resultado', async () => {
		const migrations = join(dir, 'drizzle');
		writeMigrations(migrations, 'CREATE TABLE cuentas (id TEXT PRIMARY KEY);');
		const databasePath = join(dir, 'app.db');
		const { sqlite, db } = openDatabase(databasePath);
		const logger: FakeLogger = createFakeLogger();

		const pending = await migrateDatabase({
			sqlite,
			db,
			migrationsFolder: migrations,
			databasePath,
			backupDir: join(dir, 'pre-migrate'),
			keepBackups: 3,
			version: '1.0.0',
			logger
		});

		expect(pending).toBe(1);
		expect(sqlite.prepare("SELECT name FROM sqlite_master WHERE name = 'cuentas'").get()).toEqual({
			name: 'cuentas'
		});
		expect(existsSync(join(dir, 'pre-migrate', '1.0.0.db'))).toBe(true);
		expect(eventsNamed(logger, 'app.db.migrated')[0]?.fields).toMatchObject({ count: 1 });
		sqlite.close();
	});

	it('una segunda ejecución no tiene nada pendiente y no vuelve a copiar', async () => {
		const migrations = join(dir, 'drizzle');
		writeMigrations(migrations, 'CREATE TABLE cuentas (id TEXT PRIMARY KEY);');
		const databasePath = join(dir, 'app.db');
		const { sqlite, db } = openDatabase(databasePath);
		const options = {
			sqlite,
			db,
			migrationsFolder: migrations,
			databasePath,
			backupDir: join(dir, 'pre-migrate'),
			keepBackups: 3,
			version: '1.0.0',
			logger: createFakeLogger()
		};
		await migrateDatabase(options);
		rmSync(join(dir, 'pre-migrate'), { recursive: true, force: true });

		const pending = await migrateDatabase(options);

		expect(pending).toBe(0);
		expect(existsSync(join(dir, 'pre-migrate'))).toBe(false);
		sqlite.close();
	});

	it('si una migración falla, registra app.db.migration_failed y relanza el error', async () => {
		const migrations = join(dir, 'drizzle');
		writeMigrations(migrations, 'ESTO NO ES SQL;');
		const databasePath = join(dir, 'app.db');
		const { sqlite, db } = openDatabase(databasePath);
		const logger = createFakeLogger();

		await expect(
			migrateDatabase({
				sqlite,
				db,
				migrationsFolder: migrations,
				databasePath,
				backupDir: join(dir, 'pre-migrate'),
				keepBackups: 3,
				version: '1.0.0',
				logger
			})
		).rejects.toThrow();

		expect(eventsNamed(logger, 'app.db.migration_failed')).toHaveLength(1);
		sqlite.close();
	});

	it('sin carpeta de migraciones no hay nada que aplicar', async () => {
		const databasePath = join(dir, 'app.db');
		const { sqlite, db } = openDatabase(databasePath);

		const pending = await migrateDatabase({
			sqlite,
			db,
			migrationsFolder: join(dir, 'no-existe'),
			databasePath,
			backupDir: join(dir, 'pre-migrate'),
			keepBackups: 3,
			version: '1.0.0',
			logger: createFakeLogger()
		});

		expect(pending).toBe(0);
		expect(readdirSync(dir)).toContain('app.db');
		sqlite.close();
	});
});
