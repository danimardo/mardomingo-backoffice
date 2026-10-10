// Tabla de la funcionalidad `audit` (data-model.md 2.1): registro inmutable de las acciones del administrador.
// La inmutabilidad la imponen los triggers de la migración personalizada (data-model 1.5, T075), no esta declaración.
import { check, index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { epochMs, json, nowMs } from '$lib/server/db/columns';
import { user } from '../accounts/schema';
import type { AuditSnapshot } from './json-schemas';

export const adminAudit = sqliteTable(
	'admin_audit',
	{
		id: text('id').primaryKey(),
		adminId: text('admin_id')
			.notNull()
			.references(() => user.id, { onDelete: 'restrict' }),
		action: text('action').notNull(),
		entity: text('entity').notNull(),
		entityId: text('entity_id'),
		before: json<AuditSnapshot>('before'),
		after: json<AuditSnapshot>('after'),
		reason: text('reason'),
		createdAt: epochMs('created_at').notNull().default(nowMs)
	},
	(table) => [
		check(
			'admin_audit_before_json',
			sql`${sql.identifier('before')} IS NULL OR json_valid(${sql.identifier('before')})`
		),
		check(
			'admin_audit_after_json',
			sql`${sql.identifier('after')} IS NULL OR json_valid(${sql.identifier('after')})`
		),
		index('admin_audit_entity_idx').on(table.entity, table.entityId, table.createdAt),
		index('admin_audit_created_idx').on(table.createdAt)
	]
);
