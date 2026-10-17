// Migraciones de drizzle sobre una BD vacía (T082; Historias 15.14): crean las tablas de todas las funcionalidades y
// los triggers de inmutabilidad, y aplicarlas de nuevo no cambia nada.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type OpenedDatabase } from './client';

let dir: string;
let opened: OpenedDatabase | undefined;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'mdm-migrations-'));
});

afterEach(() => {
	opened?.sqlite.close();
	opened = undefined;
	rmSync(dir, { recursive: true, force: true });
});

function namesOf(open: OpenedDatabase, type: 'table' | 'trigger'): string[] {
	return open.sqlite
		.prepare<[string], { name: string }>(
			"select name from sqlite_master where type = ? and name not like 'sqlite_%' and name not like '__drizzle%' order by name"
		)
		.all(type)
		.map((row) => row.name);
}

describe('migraciones sobre una BD vacía', () => {
	it('crean las 34 tablas de las funcionalidades y los 8 triggers de inmutabilidad', () => {
		opened = openDatabase(join(dir, 'app.db'));
		migrate(opened.db, { migrationsFolder: 'drizzle' });

		expect(namesOf(opened, 'table')).toHaveLength(34);
		expect(namesOf(opened, 'trigger')).toEqual([
			'admin_audit_no_delete',
			'admin_audit_no_update',
			'credit_movements_no_delete',
			'credit_movements_no_update',
			'invoices_no_delete',
			'invoices_no_update',
			'prompt_templates_no_delete',
			'prompt_templates_no_update'
		]);
	});

	it('aplicarlas de nuevo no cambia el esquema ni falla', () => {
		const open = openDatabase(join(dir, 'app.db'));
		opened = open;
		migrate(open.db, { migrationsFolder: 'drizzle' });
		const before = namesOf(open, 'table');

		expect(() => {
			migrate(open.db, { migrationsFolder: 'drizzle' });
		}).not.toThrow();
		expect(namesOf(open, 'table')).toEqual(before);
	});
});
