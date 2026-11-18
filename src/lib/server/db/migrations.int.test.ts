// Migraciones de drizzle sobre una BD vacía (T082; Historias 15.14): crean las tablas de todas las funcionalidades y
// los triggers de inmutabilidad, y aplicarlas de nuevo no cambia nada. Las migraciones de datos se prueban sobre una base
// desplegada en la versión anterior (journal recortado), con filas sembradas antes de aplicar las restantes.
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
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
	it('crean las 37 tablas de las funcionalidades, los 8 triggers de inmutabilidad y los 2 de cuenta borrada', () => {
		opened = openDatabase(join(dir, 'app.db'));
		migrate(opened.db, { migrationsFolder: 'drizzle' });

		expect(namesOf(opened, 'table')).toHaveLength(37);
		expect(namesOf(opened, 'trigger')).toEqual([
			'admin_audit_no_delete',
			'admin_audit_no_update',
			'credit_movements_no_delete',
			'credit_movements_no_update',
			'invoices_no_delete',
			'invoices_no_update',
			'prompt_templates_no_delete',
			'prompt_templates_no_update',
			'sync_documents_deleted_user_no_insert',
			'sync_documents_deleted_user_no_update'
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

const journalSchema = z.object({
	entries: z.array(z.looseObject({ tag: z.string() }))
});

/** Copia de `drizzle/` con el journal recortado hasta `lastTag` (incluida): simula una base desplegada en esa versión. */
function migrationsUpTo(lastTag: string): string {
	const folder = join(dir, 'drizzle-hasta');
	mkdirSync(join(folder, 'meta'), { recursive: true });
	const journal = journalSchema.parse(
		JSON.parse(readFileSync(join('drizzle', 'meta', '_journal.json'), 'utf8'))
	);
	const last = journal.entries.findIndex((entry) => entry.tag === lastTag);
	expect(last).toBeGreaterThanOrEqual(0);
	const entries = journal.entries.slice(0, last + 1);
	for (const entry of entries) {
		copyFileSync(join('drizzle', `${entry.tag}.sql`), join(folder, `${entry.tag}.sql`));
	}
	writeFileSync(join(folder, 'meta', '_journal.json'), JSON.stringify({ ...journal, entries }));
	return folder;
}

/** Inserta una app con el `sync_schema` dado, con las columnas de la versión 0016. */
function insertApp(open: OpenedDatabase, slug: string, syncSchema: unknown): void {
	open.sqlite
		.prepare(
			`INSERT INTO apps (id, slug, name, client_types, links, sync_schema, created_at, updated_at)
			 VALUES (?, ?, ?, '["desktop"]', '{"landing":{"type":"internal"}}', ?, 1000, 1000)`
		)
		.run(`app_${slug}`, slug, slug, JSON.stringify(syncSchema));
}

function appRow(open: OpenedDatabase, slug: string): { syncSchema: unknown; updatedAt: number } {
	const row = z
		.object({ sync_schema: z.string(), updated_at: z.number() })
		.parse(
			open.sqlite.prepare('SELECT sync_schema, updated_at FROM apps WHERE slug = ?').get(slug)
		);
	return { syncSchema: JSON.parse(row.sync_schema), updatedAt: row.updated_at };
}

// Esquema de `secretario` sembrado antes de D14 (sin `personal`).
const OLD_SECRETARIO_SCHEMA = {
	categories: {
		coreReplacements: { strategy: 'block' },
		prompts: { strategy: 'block' },
		preferences: { strategy: 'keyed', keys: ['language'] }
	}
};

describe('T397 (C-05): `prompts` de `secretario` pasa a ser personal en las bases ya sembradas', () => {
	const PERSONAL_PROMPTS_MIGRATION = join('drizzle', '0017_secretario_prompts_personal.sql');

	it('marca `personal: true` en la fila sembrada con el esquema anterior y actualiza `updated_at`', () => {
		const open = openDatabase(join(dir, 'app.db'));
		opened = open;
		migrate(open.db, { migrationsFolder: migrationsUpTo('0016_refund_keys_reembolso') });
		insertApp(open, 'secretario', OLD_SECRETARIO_SCHEMA);

		migrate(open.db, { migrationsFolder: 'drizzle' });

		const row = appRow(open, 'secretario');
		expect(row.syncSchema).toEqual({
			categories: {
				...OLD_SECRETARIO_SCHEMA.categories,
				prompts: { strategy: 'block', personal: true }
			}
		});
		// Cambiar `updated_at` invalida la caché de `sync` (`syncSchemaStampOf`).
		expect(row.updatedAt).toBeGreaterThan(1000);
	});

	it('no pisa un `prompts` que el administrador cambió, ni toca otras apps', () => {
		const open = openDatabase(join(dir, 'app.db'));
		opened = open;
		migrate(open.db, { migrationsFolder: migrationsUpTo('0016_refund_keys_reembolso') });
		const changedByAdmin = {
			categories: { prompts: { strategy: 'items', key: 'id', tombstone_ttl_days: 30 } }
		};
		insertApp(open, 'secretario', changedByAdmin);
		insertApp(open, 'otra', OLD_SECRETARIO_SCHEMA);

		migrate(open.db, { migrationsFolder: 'drizzle' });

		expect(appRow(open, 'secretario')).toEqual({ syncSchema: changedByAdmin, updatedAt: 1000 });
		expect(appRow(open, 'otra')).toEqual({ syncSchema: OLD_SECRETARIO_SCHEMA, updatedAt: 1000 });
	});

	it('es idempotente: repetir la sentencia no vuelve a tocar la fila', () => {
		const open = openDatabase(join(dir, 'app.db'));
		opened = open;
		migrate(open.db, { migrationsFolder: migrationsUpTo('0016_refund_keys_reembolso') });
		insertApp(open, 'secretario', OLD_SECRETARIO_SCHEMA);
		migrate(open.db, { migrationsFolder: 'drizzle' });
		open.sqlite.prepare('UPDATE apps SET updated_at = 2000 WHERE slug = ?').run('secretario');
		const migrated = appRow(open, 'secretario');

		open.sqlite.exec(readFileSync(PERSONAL_PROMPTS_MIGRATION, 'utf8'));
		migrate(open.db, { migrationsFolder: 'drizzle' });

		expect(appRow(open, 'secretario')).toEqual(migrated);
	});
});

describe('T405 (C-13): `refund_keys` guarda importe y total del reembolso', () => {
	/** Compra y clave de reembolso aplicada con las columnas de la versión 0017 (las FK de la compra no importan aquí). */
	function insertLegacyRefundKey(open: OpenedDatabase): void {
		open.sqlite.pragma('foreign_keys = OFF');
		open.sqlite.exec(
			`INSERT INTO payments (id, user_id, pack_id, attempt_id, provider, provider_ref, status, amount_eur_cents,
				base_eur_cents, vat_eur_cents, vat_rate_ppm, country, credits_micro, simulated, withdrawal_acceptance_id,
				refunded_eur_cents, completed_at)
			 VALUES ('pay_1', 'usr_1', 'pck_1', 'att_1', 'stripe', 'ref_1', 'partially_refunded', 1000, 826, 174, 210000, 'ES',
				10500000000, 0, 'tac_1', 400, 1000);
			 INSERT INTO refund_keys (key, payment_id, status, created_at) VALUES ('k_antigua', 'pay_1', 'applied', 2000);`
		);
		open.sqlite.pragma('foreign_keys = ON');
	}

	function refundKeyRows(open: OpenedDatabase): unknown[] {
		return open.sqlite
			.prepare(
				'SELECT key, payment_id, status, amount_eur_cents, refunded_after_eur_cents, created_at FROM refund_keys ORDER BY key'
			)
			.all();
	}

	it('conserva las claves existentes con importe y total nulos, y su índice', () => {
		const open = openDatabase(join(dir, 'app.db'));
		opened = open;
		migrate(open.db, { migrationsFolder: migrationsUpTo('0017_secretario_prompts_personal') });
		insertLegacyRefundKey(open);

		migrate(open.db, { migrationsFolder: 'drizzle' });

		expect(refundKeyRows(open)).toEqual([
			{
				key: 'k_antigua',
				payment_id: 'pay_1',
				status: 'applied',
				amount_eur_cents: null,
				refunded_after_eur_cents: null,
				created_at: 2000
			}
		]);
		expect(
			open.sqlite
				.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'refund_keys'")
				.all()
		).toContainEqual({ name: 'refund_keys_payment_idx' });
		expect(open.sqlite.pragma('foreign_key_check(refund_keys)')).toEqual([]);
	});

	it('admite importe y total juntos y rechaza uno sin el otro, negativos o un total menor que el importe', () => {
		const open = openDatabase(join(dir, 'app.db'));
		opened = open;
		migrate(open.db, { migrationsFolder: migrationsUpTo('0017_secretario_prompts_personal') });
		insertLegacyRefundKey(open);
		migrate(open.db, { migrationsFolder: 'drizzle' });
		const insert = open.sqlite.prepare(
			"INSERT INTO refund_keys (key, payment_id, status, amount_eur_cents, refunded_after_eur_cents) VALUES (?, 'pay_1', 'applied', ?, ?)"
		);

		expect(() => insert.run('k_nueva', 300, 700)).not.toThrow();
		expect(() => insert.run('k_solo_importe', 300, null)).toThrow(/CHECK/);
		expect(() => insert.run('k_solo_total', null, 700)).toThrow(/CHECK/);
		expect(() => insert.run('k_negativa', -1, 700)).toThrow(/CHECK/);
		expect(() => insert.run('k_total_menor', 300, 200)).toThrow(/CHECK/);
	});
});

describe('T435 (C-43): `sync_documents` rechaza las filas de una cuenta borrada', () => {
	/** Cuenta viva (`deleted_at` nulo) o borrada y anonimizada (`deleted_at` con fecha), con las columnas obligatorias de `user`. */
	function insertUser(open: OpenedDatabase, id: string, deletedAt: number | null): void {
		open.sqlite
			.prepare(
				`INSERT INTO user (id, name, email, email_verified, role, banned, email_normalized, deleted_at, created_at, updated_at)
				 VALUES (?, '', ?, 1, 'user', 0, ?, ?, 1000, 1000)`
			)
			.run(
				id,
				deletedAt === null ? `${id}@ejemplo.es` : `deleted+${id}@invalid`,
				deletedAt === null ? `${id}@ejemplo.es` : null,
				deletedAt
			);
	}

	function migratedWithAccounts(): OpenedDatabase {
		const open = openDatabase(join(dir, 'app.db'));
		opened = open;
		migrate(open.db, { migrationsFolder: 'drizzle' });
		insertApp(open, 'notas', { categories: { notas: { strategy: 'block' } } });
		insertUser(open, 'usr_viva', null);
		insertUser(open, 'usr_borrada', 5000);
		return open;
	}

	const INSERT_DOCUMENT =
		"INSERT INTO sync_documents (user_id, app_id, revision, data, created_at, updated_at) VALUES (?, 'app_notas', 1, '{}', 1000, 1000)";

	it('una cuenta viva inserta, actualiza y borra su documento', () => {
		const open = migratedWithAccounts();

		expect(() => open.sqlite.prepare(INSERT_DOCUMENT).run('usr_viva')).not.toThrow();
		expect(() =>
			open.sqlite
				.prepare('UPDATE sync_documents SET revision = 2, data = \'{"a":1}\' WHERE user_id = ?')
				.run('usr_viva')
		).not.toThrow();
		expect(
			open.sqlite.prepare('DELETE FROM sync_documents WHERE user_id = ?').run('usr_viva').changes
		).toBe(1);
	});

	it('una cuenta borrada no puede insertar un documento: aborta con el mensaje que traduce `sync`', () => {
		const open = migratedWithAccounts();

		expect(() => open.sqlite.prepare(INSERT_DOCUMENT).run('usr_borrada')).toThrow(
			/^sync_documents_user_deleted$/
		);
		expect(open.sqlite.prepare('SELECT count(*) AS n FROM sync_documents').get()).toEqual({ n: 0 });
	});

	it('el documento de una cuenta que se borra después ya no se actualiza, pero sí se borra', () => {
		const open = migratedWithAccounts();
		open.sqlite.prepare(INSERT_DOCUMENT).run('usr_viva');
		open.sqlite
			.prepare('UPDATE user SET deleted_at = 6000, email_normalized = NULL WHERE id = ?')
			.run('usr_viva');

		expect(() =>
			open.sqlite
				.prepare('UPDATE sync_documents SET revision = revision + 1 WHERE user_id = ?')
				.run('usr_viva')
		).toThrow(/^sync_documents_user_deleted$/);
		expect(
			open.sqlite.prepare('DELETE FROM sync_documents WHERE user_id = ?').run('usr_viva').changes
		).toBe(1);
	});

	it('pasar un documento a una cuenta borrada también se rechaza', () => {
		const open = migratedWithAccounts();
		open.sqlite.prepare(INSERT_DOCUMENT).run('usr_viva');

		expect(() =>
			open.sqlite
				.prepare("UPDATE sync_documents SET user_id = 'usr_borrada' WHERE user_id = 'usr_viva'")
				.run()
		).toThrow(/^sync_documents_user_deleted$/);
	});
});
