// Conexión única a SQLite (constitución, principio VI; R03). WAL, claves foráneas, espera de 5 s ante
// bloqueos y `synchronous = NORMAL` se fijan aquí y en ningún otro sitio.
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

export type Db = BetterSQLite3Database;

export interface OpenedDatabase {
	readonly sqlite: Database.Database;
	readonly db: Db;
}

export function openDatabase(path: string): OpenedDatabase {
	const sqlite = new Database(path);
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');
	sqlite.pragma('busy_timeout = 5000');
	sqlite.pragma('synchronous = NORMAL');
	return { sqlite, db: drizzle(sqlite) };
}
