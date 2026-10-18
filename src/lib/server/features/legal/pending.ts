// Documentos legales que una cuenta todavía no ha aceptado en su versión vigente que exige reaceptación (BE-FR-70 CA1; T133; T314). Los tres de
// la aceptación del registro: términos, privacidad y uso aceptable. La edad no se vuelve a pedir.
import { and, desc, eq } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import type { EpochMs } from '$lib/shared/time';
import { readCurrentVersion, type AcceptableDocument, type LegalDocumentName } from './repository';
import { termsAcceptances } from './schema';

export interface PendingAcceptance {
	readonly document: AcceptableDocument;
	readonly version: string;
}

const PENDING_CHECKED: readonly LegalDocumentName[] = Object.freeze(['terms', 'privacy', 'aup']);

/** Documentos cuya versión vigente no tiene una aceptación de esta cuenta. */
export function pendingAcceptancesOf(
	db: Db,
	userId: string,
	now: EpochMs
): readonly PendingAcceptance[] {
	return PENDING_CHECKED.flatMap((document) => {
		const current = readCurrentVersion(db, document, now);
		// Solo una versión que exige reaceptación bloquea (BE-FR-70); una informativa solo se notifica.
		if (current === undefined || !current.requiresReacceptance) return [];
		const accepted = db
			.select({ version: termsAcceptances.version })
			.from(termsAcceptances)
			.where(
				and(
					eq(termsAcceptances.userId, userId),
					eq(termsAcceptances.document, document),
					eq(termsAcceptances.version, current.version)
				)
			)
			.orderBy(desc(termsAcceptances.acceptedAt))
			.limit(1)
			.get();
		return accepted === undefined ? [{ document, version: current.version }] : [];
	});
}
