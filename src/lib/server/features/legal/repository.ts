// Acceso a `legal_documents` y `terms_acceptances`. Solo toca tablas de `legal`.
import { and, desc, eq, lte } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import type { Tx } from '$lib/server/db/tx';
import type { EpochMs } from '$lib/shared/time';
import {
	legalDocuments,
	termsAcceptances,
	LEGAL_DOCUMENTS,
	type ACCEPTABLE_DOCUMENTS
} from './schema';

export type AcceptableDocument = (typeof ACCEPTABLE_DOCUMENTS)[number];

/** Documentos con versión publicada en `legal_documents` (la declaración de edad no lo es). */
export type LegalDocumentName = (typeof LEGAL_DOCUMENTS)[number];

export interface CurrentVersion {
	readonly version: string;
	readonly requiresReacceptance: boolean;
}

/** Versión vigente de un documento: la de mayor `published_at` ≤ ahora (data-model 2.4). */
export function readCurrentVersion(
	db: Db,
	document: LegalDocumentName,
	now: EpochMs
): CurrentVersion | undefined {
	const row = db
		.select({
			version: legalDocuments.version,
			requiresReacceptance: legalDocuments.requiresReacceptance
		})
		.from(legalDocuments)
		.where(and(eq(legalDocuments.document, document), lte(legalDocuments.publishedAt, now)))
		.orderBy(desc(legalDocuments.publishedAt))
		.limit(1)
		.get();
	return row;
}

export function insertDocument(
	tx: Tx,
	row: typeof legalDocuments.$inferInsert,
	options: { readonly ignoreExisting: boolean }
): void {
	const insert = tx.insert(legalDocuments).values(row);
	if (options.ignoreExisting) insert.onConflictDoNothing().run();
	else insert.run();
}

export function insertAcceptance(tx: Tx, row: typeof termsAcceptances.$inferInsert): void {
	tx.insert(termsAcceptances).values(row).onConflictDoNothing().run();
}
