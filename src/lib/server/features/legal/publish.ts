// Publicación de una versión legal (BE-FR-70, BE-FR-26; T314). La versión es inmutable: no se edita, y su par (documento, versión) es
// único. El contenido se guarda en Markdown con su hash SHA-256. Una versión que exige reaceptación bloquea IA y sincronización (lo
// aplican las lecturas de pendientes); una informativa solo se avisa. La auditoría va en la misma transacción.
import { createHash } from 'node:crypto';
import type { Clock } from '$lib/server/adapters/clock/clock';
import type { Db } from '$lib/server/db/client';
import { immediateTransaction } from '$lib/server/db/tx';
import { recordEntry, type AuditDeps } from '$lib/server/features/audit';
import type { Logger } from '$lib/server/logging/logger';
import { AppError } from '$lib/server/shared/errors';
import type { IdGenerator } from '$lib/server/shared/ids';
import { toEpochMs } from '$lib/shared/time';
import { insertDocument, type LegalDocumentName } from './repository';
import { LEGAL_DOCUMENTS } from './schema';

export interface PublishDeps {
	readonly db: Db;
	readonly logger: Logger;
	readonly clock: Clock;
	readonly ids: IdGenerator;
	readonly audit: AuditDeps;
}

const VERSION = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CONTENT = 200_000;

export interface PublishInput {
	readonly adminId: string;
	readonly document: LegalDocumentName;
	readonly version: string;
	readonly content: string;
	readonly requiresReacceptance: boolean;
}

export function publishVersion(
	deps: PublishDeps,
	input: PublishInput
): { id: string; auditId: string } {
	if (!LEGAL_DOCUMENTS.some((document) => document === input.document)) {
		throw new AppError('VALIDATION_ERROR', { field: 'document' });
	}
	if (!VERSION.test(input.version)) throw new AppError('VALIDATION_ERROR', { field: 'version' });
	const content = input.content.trim();
	if (content === '' || content.length > MAX_CONTENT)
		throw new AppError('VALIDATION_ERROR', { field: 'content' });

	return immediateTransaction(deps.db, (tx) => {
		const id = deps.ids('ldoc');
		const now = toEpochMs(deps.clock.now());
		try {
			insertDocument(
				tx,
				{
					id,
					document: input.document,
					version: input.version,
					content,
					contentHash: createHash('sha256').update(content, 'utf8').digest('hex'),
					requiresReacceptance: input.requiresReacceptance,
					publishedAt: now,
					createdBy: input.adminId,
					createdAt: now
				},
				{ ignoreExisting: false }
			);
		} catch {
			// Única por documento y versión: una segunda publicación de la misma versión no sustituye a la primera.
			throw new AppError('VALIDATION_ERROR', { field: 'version' });
		}
		const auditId = recordEntry(
			tx,
			{
				adminId: input.adminId,
				action: 'legal.document.publish',
				entity: 'legal_document',
				entityId: `${input.document}:${input.version}`,
				before: null,
				after: { requiresReacceptance: input.requiresReacceptance },
				reason: null
			},
			deps.audit
		);
		deps.logger.emit('legal.document.published', {
			requiresReacceptance: input.requiresReacceptance
		});
		return { id, auditId };
	});
}
