// Documentos legales vigentes y aceptaciones (BE-FR-01 CA2, BE-FR-69, BE-FR-70; FR-103). La aceptación solo vale si la
// versión que se acepta es la vigente en ese momento: si cambió mientras el usuario leía el formulario, se rechaza
// con LEGAL_VERSION_CHANGED y se le vuelven a mostrar los documentos.
import { AppError } from '$lib/server/shared/errors';
import type { Tx } from '$lib/server/db/tx';
import type { Db } from '$lib/server/db/client';
import type { Logger } from '$lib/server/logging/logger';
import type { IdGenerator } from '$lib/server/shared/ids';
import type { EpochMs } from '$lib/shared/time';
import {
	readCurrentVersion,
	insertAcceptance,
	type AcceptableDocument,
	type CurrentVersion,
	type LegalDocumentName
} from './repository';

export interface LegalDeps {
	readonly db: Db;
	readonly logger: Logger;
	readonly ids: IdGenerator;
}

export interface AcceptanceInput {
	readonly document: AcceptableDocument;
	readonly version: string;
}

/** Versiones vigentes de los documentos que se aceptan en el registro (W08). */
export function currentVersions(
	deps: Pick<LegalDeps, 'db'>,
	now: EpochMs,
	documents: readonly LegalDocumentName[]
): Map<LegalDocumentName, CurrentVersion> {
	const result = new Map<LegalDocumentName, CurrentVersion>();
	for (const document of documents) {
		const current = readCurrentVersion(deps.db, document, now);
		if (current !== undefined) result.set(document, current);
	}
	return result;
}

/**
 * Registra las aceptaciones dentro de la transacción del alta. Cada versión debe ser la vigente; si una no lo es,
 * se lanza LEGAL_VERSION_CHANGED y no se escribe nada (la transacción se revierte entera).
 */
export function recordAcceptances(
	tx: Tx,
	deps: LegalDeps,
	input: {
		readonly userId: string;
		readonly appId: string | null;
		readonly ip: string | null;
		readonly now: EpochMs;
		readonly accepted: readonly AcceptanceInput[];
	}
): number {
	for (const item of input.accepted) {
		// La declaración de edad no es un documento: su versión es el `min_age` vigente y la fija el llamador (BE-FR-69).
		if (item.document === 'age_declaration') continue;
		const current = readCurrentVersion(deps.db, item.document, input.now);
		if (current === undefined || current.version !== item.version) {
			deps.logger.emit('legal.acceptance.rejected', {
				reason: 'version_not_current',
				errorCode: 'LEGAL_VERSION_CHANGED'
			});
			throw new AppError('LEGAL_VERSION_CHANGED');
		}
	}
	for (const item of input.accepted) {
		insertAcceptance(tx, {
			id: deps.ids('tac'),
			userId: input.userId,
			document: item.document,
			version: item.version,
			acceptedAt: input.now,
			ip: input.ip,
			appId: input.appId
		});
	}
	deps.logger.emit('legal.acceptance.recorded', { count: input.accepted.length });
	return input.accepted.length;
}
