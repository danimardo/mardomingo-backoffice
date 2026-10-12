// Documentos de sincronización y predeterminados por app (BE-FR-39, BE-FR-40, BE-FR-42; data-model 2.10; T211). Las filas
// de `sync_documents` solo las escribe `sync` (con `If-Match`); los predeterminados los cambia el administrador (L13).
import { sql } from 'drizzle-orm';
import { check, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { epochMs, json, jsonCheck, nowMs } from '$lib/server/db/columns';
import { user } from '$lib/server/features/accounts/schema';
import { apps } from '$lib/server/features/apps/schema';
import type { SyncData } from './domain/document-types';

export const syncDocuments = sqliteTable(
	'sync_documents',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'restrict' }),
		appId: text('app_id')
			.notNull()
			.references(() => apps.id),
		revision: integer('revision').notNull().default(1),
		data: json<SyncData>('data').notNull(),
		createdAt: epochMs('created_at').notNull().default(nowMs),
		updatedAt: epochMs('updated_at').notNull().default(nowMs)
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.appId] }),
		check('sync_documents_revision_min', sql`${sql.identifier('revision')} >= 1`),
		check('sync_documents_data_json', jsonCheck(table.data.name)),
		index('sync_documents_app_idx').on(table.appId)
	]
);

export const appDefaults = sqliteTable(
	'app_defaults',
	{
		appId: text('app_id')
			.primaryKey()
			.references(() => apps.id),
		data: json<SyncData>('data').notNull(),
		updatedAt: epochMs('updated_at').notNull().default(nowMs)
	},
	(table) => [check('app_defaults_data_json', jsonCheck(table.data.name))]
);
