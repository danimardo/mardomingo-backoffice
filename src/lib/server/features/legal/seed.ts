// Versiones provisionales de los documentos legales (BE-FR-70, BE-FR-26; T093). Su texto NO es el definitivo: el
// propietario lo da con T092. Se siembran con `created_by` nulo (versión del sistema, O1) y de forma idempotente.
import { createHash } from 'node:crypto';
import type { Tx } from '$lib/server/db/tx';
import type { EpochMs } from '$lib/shared/time';
import { insertDocument } from './repository';
import { LEGAL_DOCUMENTS } from './schema';

/** Versión provisional de la primera publicación del sistema. */
export const PROVISIONAL_VERSION = '2026-10-11';

const PROVISIONAL_TEXT =
	'Texto provisional pendiente de la versión definitiva que aprueba el propietario (T092). No es un documento vigente.';

export function seedLegalDocuments(tx: Tx, ids: () => string, now: EpochMs): void {
	const hash = createHash('sha256').update(PROVISIONAL_TEXT, 'utf8').digest('hex');
	for (const document of LEGAL_DOCUMENTS) {
		insertDocument(
			tx,
			{
				id: ids(),
				document,
				version: PROVISIONAL_VERSION,
				content: PROVISIONAL_TEXT,
				contentHash: hash,
				// Exige aceptación: quien no haya aceptado la primera versión queda bloqueado hasta aceptarla (BE-FR-70 CA1).
				requiresReacceptance: true,
				publishedAt: now,
				createdBy: null,
				createdAt: now
			},
			{ ignoreExisting: true }
		);
	}
}
