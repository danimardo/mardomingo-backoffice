// Tabla de `notifications` (data-model.md 2.2; T151): estado de las alertas al administrador. Una fila por clave: si la
// alerta está activa y cuándo se envió. Su único propósito es no repetir un aviso mientras la condición siga.
import { sql } from 'drizzle-orm';
import { check, index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { bool, boolCheck, epochMs, nowMs } from '$lib/server/db/columns';

export const alertsState = sqliteTable(
	'alerts_state',
	{
		key: text('key').primaryKey(),
		active: bool('active').notNull().default(false),
		lastSentAt: epochMs('last_sent_at'),
		updatedAt: epochMs('updated_at').notNull().default(nowMs)
	},
	(table) => [
		check('alerts_state_active_bool', boolCheck(table.active.name)),
		check('alerts_state_key_not_empty', sql`length(${sql.identifier('key')}) > 0`),
		// Purga de claves por fecha o por usuario (data-model 2.2).
		index('alerts_state_updated_idx').on(table.updatedAt)
	]
);
