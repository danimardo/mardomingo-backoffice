// Estado persistido de `protections` (data-model 2.11; BE-FR-46; T196): el freno global del día y su liberación manual.
// Una fila por clave; hoy solo `global_brake`. El valor JSON lo valida `repository.ts` al leerlo.
import { sql } from 'drizzle-orm';
import { check, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { epochMs, json, jsonCheck, nowMs } from '$lib/server/db/columns';
import type { BrakeState } from './domain/brake';

export const protectionState = sqliteTable(
	'protection_state',
	{
		key: text('key').primaryKey(),
		value: json<BrakeState>('value').notNull(),
		updatedAt: epochMs('updated_at').notNull().default(nowMs)
	},
	(table) => [
		check('protection_state_known_key', sql`${sql.identifier('key')} IN ('global_brake')`),
		check('protection_state_value_json', jsonCheck(table.value.name))
	]
);
