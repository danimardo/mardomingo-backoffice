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

/** Aceptaciones de la cuenta, de la más antigua a la más reciente (BE-FR-08). */
export function acceptancesOfUser(db: Db | Tx, userId: string) {
	return db
		.select()
		.from(termsAcceptances)
		.where(eq(termsAcceptances.userId, userId))
		.orderBy(termsAcceptances.acceptedAt, termsAcceptances.id)
		.all();
}

export function insertAcceptance(tx: Tx, row: typeof termsAcceptances.$inferInsert): void {
	tx.insert(termsAcceptances).values(row).onConflictDoNothing().run();
}

/** ¿La renuncia es una aceptación de desistimiento de esta cuenta? Sin ella, la compra no se puede registrar (BE-FR-26). */
export function isOwnWithdrawalWaiver(db: Db | Tx, userId: string, acceptanceId: string): boolean {
	return (
		db
			.select({ id: termsAcceptances.id })
			.from(termsAcceptances)
			.where(
				and(
					eq(termsAcceptances.id, acceptanceId),
					eq(termsAcceptances.userId, userId),
					eq(termsAcceptances.document, 'withdrawal_waiver')
				)
			)
			.get() !== undefined
	);
}

export interface PublishedDocument {
	readonly document: LegalDocumentName;
	readonly version: string;
	readonly content: string;
	readonly publishedAt: EpochMs;
}

/** Versión vigente de un documento con su texto, para mostrarlo en las páginas públicas (BE-FR-60). */
export function readCurrentDocument(
	db: Db,
	document: LegalDocumentName,
	now: EpochMs
): PublishedDocument | undefined {
	return db
		.select({
			document: legalDocuments.document,
			version: legalDocuments.version,
			content: legalDocuments.content,
			publishedAt: legalDocuments.publishedAt
		})
		.from(legalDocuments)
		.where(and(eq(legalDocuments.document, document), lte(legalDocuments.publishedAt, now)))
		.orderBy(desc(legalDocuments.publishedAt))
		.limit(1)
		.get();
}
