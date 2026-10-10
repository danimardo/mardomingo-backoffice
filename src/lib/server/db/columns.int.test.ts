// Columnas de dominio contra SQLite real (T-INT; R03; data-model.md 1.1). Comprueba que la conversión al leer
// también se aplica en selecciones parciales, y que los CHECK de la tabla rechazan lo que el dominio no admite.
import { check, sqliteTable } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type Db } from './client';
import {
	bool,
	boolCheck,
	civilDate,
	civilDateCheck,
	epochMs,
	json,
	jsonCheck,
	enumCheck,
	micro,
	nonNegativeCheck
} from './columns';
import { toCivilDate } from '$lib/shared/time';

const ledger = sqliteTable(
	'ledger_test',
	{
		flag: bool('flag'),
		amountMicro: micro('amount_micro').notNull(),
		day: civilDate('day').notNull(),
		createdAt: epochMs('created_at').notNull(),
		active: bool('active').notNull(),
		payload: json<{ kind: string }>('payload').notNull()
	},
	(table) => [
		check('amount_non_negative', nonNegativeCheck(table.amountMicro.name)),
		check('day_format', civilDateCheck(table.day.name)),
		check('active_bool', boolCheck(table.active.name)),
		check('payload_json', jsonCheck(table.payload.name))
	]
);

let handle: ReturnType<typeof openDatabase> | undefined;

afterEach(() => {
	handle?.sqlite.close();
	handle = undefined;
});

function open(): Db {
	handle = openDatabase(':memory:');
	handle.sqlite.exec(`
		CREATE TABLE ledger_test (
			flag INTEGER,
			amount_micro INTEGER NOT NULL CHECK (amount_micro >= 0),
			day TEXT NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
			created_at INTEGER NOT NULL,
			active INTEGER NOT NULL CHECK (active IN (0, 1)),
			payload TEXT NOT NULL CHECK (json_valid(payload))
		);
	`);
	return handle.db;
}

describe('columnas de dominio', () => {
	it('la selección parcial también convierte el tipo de dominio', () => {
		const db = open();
		db.insert(ledger)
			.values({
				flag: false,
				amountMicro: 776_480,
				day: toCivilDate('2026-10-25'),
				createdAt: 1_792_879_200_000,
				active: true,
				payload: { kind: 'chat' }
			})
			.run();

		const [partial] = db.select({ amount: ledger.amountMicro, day: ledger.day }).from(ledger).all();

		expect(partial).toEqual({ amount: 776_480, day: '2026-10-25' });
	});

	it('un importe negativo no entra: el CHECK lo rechaza', () => {
		const db = open();

		expect(() =>
			db
				.insert(ledger)
				.values({
					flag: false,
					amountMicro: -1,
					day: toCivilDate('2026-10-25'),
					createdAt: 1,
					active: true,
					payload: { kind: 'x' }
				})
				.run()
		).toThrow();
	});

	it('un día con otra forma no entra: el CHECK lo rechaza', () => {
		const db = open();

		expect(() =>
			db.run(
				sql`INSERT INTO ledger_test (amount_micro, day, created_at, active, payload) VALUES (1, '25/10/2026', 1, 1, '{}')`
			)
		).toThrow();
	});

	it('un booleano distinto de 0 o 1 no entra', () => {
		const db = open();

		expect(() =>
			db.run(
				sql`INSERT INTO ledger_test (amount_micro, day, created_at, active, payload) VALUES (1, '2026-10-25', 1, 2, '{}')`
			)
		).toThrow();
	});

	it('un JSON inválido no entra', () => {
		const db = open();

		expect(() =>
			db.run(
				sql`INSERT INTO ledger_test (amount_micro, day, created_at, active, payload) VALUES (1, '2026-10-25', 1, 1, '{no json')`
			)
		).toThrow();
	});

	it('un valor fuera de un enumerado no entra: el CHECK lo rechaza', () => {
		const db = open();
		db.run(
			sql`CREATE TABLE status_test (status TEXT NOT NULL CHECK (${enumCheck('status', ['active', 'disabled'])}))`
		);
		db.run(sql`INSERT INTO status_test (status) VALUES ('active')`);

		expect(() => db.run(sql`INSERT INTO status_test (status) VALUES ('deleted')`)).toThrow();
	});

	it('un enumerado solo admite literales en minúsculas con guion bajo', () => {
		expect(() => enumCheck('status', ['Active'])).toThrow('Valor de enumerado no válido');
	});
});
