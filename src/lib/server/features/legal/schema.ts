// Tablas de la funcionalidad `legal` (data-model.md 2.4): versiones de los documentos legales y aceptaciones.
// Las claves a `user` y a `apps` son `references()` (D-03); el texto se compara por `content_hash`.
import { check, index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { bool, boolCheck, enumCheck, epochMs, nowMs } from '$lib/server/db/columns';
import { apps } from '../apps/schema';
import { user } from '../accounts/schema';

export const LEGAL_DOCUMENTS = Object.freeze([
	'terms',
	'privacy',
	'cookies',
	'aup',
	'withdrawal_waiver'
] as const);

export const ACCEPTABLE_DOCUMENTS = Object.freeze([...LEGAL_DOCUMENTS, 'age_declaration'] as const);

export const legalDocuments = sqliteTable(
	'legal_documents',
	{
		id: text('id').primaryKey(),
		document: text('document', { enum: LEGAL_DOCUMENTS }).notNull(),
		version: text('version').notNull(),
		content: text('content').notNull(),
		contentHash: text('content_hash').notNull(),
		requiresReacceptance: bool('requires_reacceptance').notNull().default(false),
		publishedAt: epochMs('published_at').notNull(),
		// NULL solo en las versiones sembradas por el sistema (O1); toda publicación desde el panel lo rellena.
		createdBy: text('created_by').references(() => user.id, { onDelete: 'restrict' }),
		createdAt: epochMs('created_at').notNull().default(nowMs)
	},
	(table) => [
		uniqueIndex('legal_documents_document_version_unique').on(table.document, table.version),
		index('legal_documents_published_idx').on(table.document, table.publishedAt),
		check('legal_documents_document_enum', enumCheck(table.document.name, LEGAL_DOCUMENTS)),
		check('legal_documents_reacceptance_bool', boolCheck(table.requiresReacceptance.name))
	]
);

export const termsAcceptances = sqliteTable(
	'terms_acceptances',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		document: text('document', { enum: ACCEPTABLE_DOCUMENTS }).notNull(),
		// En `age_declaration`, la versión es el `min_age` vigente («18»).
		version: text('version').notNull(),
		acceptedAt: epochMs('accepted_at').notNull().default(nowMs),
		ip: text('ip'),
		appId: text('app_id').references(() => apps.id, { onDelete: 'restrict' })
	},
	(table) => [
		// Aceptar dos veces es idempotente; la renuncia al desistimiento se registra en cada compra (por eso se excluye).
		uniqueIndex('terms_acceptances_user_document_version_unique')
			.on(table.userId, table.document, table.version)
			.where(sql`${sql.identifier('document')} <> 'withdrawal_waiver'`),
		index('terms_acceptances_pending_idx').on(table.userId, table.document, table.acceptedAt),
		check('terms_acceptances_document_enum', enumCheck(table.document.name, ACCEPTABLE_DOCUMENTS))
	]
);
