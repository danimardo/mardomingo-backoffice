// Servicio de `sync` (BE-FR-39 a BE-FR-42, FR-064 a FR-068; T217). Documento por (cuenta, app) con revisión; escritura
// condicional con `If-Match`; predeterminados por app; copia de datos como predeterminados con auditoría. La comprobación
// de versión, mantenimiento y documentos legales va en las rutas: la arquitectura solo permite a `sync` depender de
// `apps` y `audit`.
import type { Clock } from '$lib/server/adapters/clock/clock';
import type { Db } from '$lib/server/db/client';
import { immediateTransaction, type Tx } from '$lib/server/db/tx';
import { recordEntry, type AuditDeps } from '$lib/server/features/audit';
import { getEffectiveConfig, syncSchemaOf, type AppsDeps } from '$lib/server/features/apps';
import type { Logger } from '$lib/server/logging/logger';
import { AppError } from '$lib/server/shared/errors';
import { toEpochMs, type EpochMs } from '$lib/shared/time';
import {
	applyCopy,
	previewCopy,
	type PreviewCategory,
	type Selection
} from './domain/copy-defaults';
import { validateDocument } from './domain/document-schema';
import type { SyncData } from './domain/document-types';
import type { SyncSchema } from './domain/schema-types';
import { seedDocumentFrom } from './domain/seed';
import {
	findDefaults,
	findDocument,
	insertDocument,
	replaceIfRevision,
	writeDefaults
} from './repository';

export interface SyncDeps {
	readonly db: Db;
	readonly clock: Clock;
	readonly logger: Logger;
	readonly apps: AppsDeps;
	readonly audit: AuditDeps;
}

const KB = 1024;

function schemaAndLimit(deps: SyncDeps, appId: string): { schema: SyncSchema; maxBytes: number } {
	const schema = syncSchemaOf(deps.apps, appId);
	const maxKb = getEffectiveConfig(deps.apps, { appId }).settings.max_sync_doc_kb;
	return { schema, maxBytes: maxKb * KB };
}

function isRecord(value: unknown): value is SyncData {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Lee el documento de la cuenta y, si no existe, lo siembra con los predeterminados (una sola vez, BE-FR-40). */
function documentOrSeed(
	tx: Tx,
	deps: SyncDeps,
	userId: string,
	appId: string,
	now: EpochMs
): { readonly revision: number; readonly data: SyncData } {
	const stored = findDocument(tx, userId, appId);
	if (stored !== undefined) {
		if (!isRecord(stored.data)) {
			deps.logger.emit('sync.document.corrupt', {});
			throw new AppError('INTERNAL_ERROR', { reason: 'sync_document_corrupt' });
		}
		return { revision: stored.revision, data: stored.data };
	}
	const seeded = seedDocumentFrom(findDefaults(tx, appId) ?? {});
	insertDocument(tx, { userId, appId, data: seeded.data, now });
	deps.logger.emit('sync.document.seeded', {});
	return seeded;
}

export function getSyncDocument(
	deps: SyncDeps,
	input: { readonly userId: string; readonly appId: string }
): { readonly revision: number; readonly data: SyncData } {
	const now = toEpochMs(deps.clock.now());
	return immediateTransaction(deps.db, (tx) =>
		documentOrSeed(tx, deps, input.userId, input.appId, now)
	);
}

/**
 * Sustituye el documento si `If-Match` coincide con la revisión actual (BE-FR-41). Si aún no hay documento, se siembra
 * primero, así que `If-Match: 1` es el primer PUT posible. Sin coincidencia → `SYNC_CONFLICT` (412).
 */
export function putSyncDocument(
	deps: SyncDeps,
	input: {
		readonly userId: string;
		readonly appId: string;
		readonly ifMatch: number;
		readonly data: unknown;
	}
): { readonly revision: number } {
	const { schema, maxBytes } = schemaAndLimit(deps, input.appId);
	const verdict = validateDocument(schema, input.data, maxBytes);
	if (!verdict.ok) {
		if (verdict.reason === 'too_large') {
			deps.logger.emit('sync.document.rejected', { reason: 'too_large' });
			throw new AppError('PAYLOAD_TOO_LARGE');
		}
		deps.logger.emit('sync.document.rejected', { reason: 'validation' });
		throw new AppError('VALIDATION_ERROR', { field: verdict.field });
	}
	if (!isRecord(input.data)) throw new AppError('VALIDATION_ERROR', { field: 'data' });
	const data = input.data;
	const now = toEpochMs(deps.clock.now());

	return immediateTransaction(deps.db, (tx) => {
		const current = documentOrSeed(tx, deps, input.userId, input.appId, now);
		const written =
			current.revision === input.ifMatch &&
			replaceIfRevision(tx, {
				userId: input.userId,
				appId: input.appId,
				expectedRevision: current.revision,
				data,
				now
			});
		if (!written) {
			deps.logger.emit('sync.document.rejected', { reason: 'revision_conflict' });
			throw new AppError('SYNC_CONFLICT');
		}
		return { revision: current.revision + 1 };
	});
}

export function getDefaults(deps: SyncDeps, appId: string): SyncData {
	return immediateTransaction(deps.db, (tx) => findDefaults(tx, appId) ?? {});
}

/** Cambia los predeterminados (BE-FR-42): no toca ninguna cuenta (CA1) y deja auditoría. */
export function updateDefaults(
	deps: SyncDeps,
	input: { readonly adminId: string; readonly appId: string; readonly data: unknown }
): void {
	const { schema, maxBytes } = schemaAndLimit(deps, input.appId);
	const verdict = validateDocument(schema, input.data, maxBytes);
	if (!verdict.ok) throw new AppError('VALIDATION_ERROR', { field: verdict.field });
	if (!isRecord(input.data)) throw new AppError('VALIDATION_ERROR', { field: 'data' });
	const data = input.data;
	const now = toEpochMs(deps.clock.now());
	immediateTransaction(deps.db, (tx) => {
		writeDefaults(tx, input.appId, data, now);
		recordEntry(
			tx,
			{
				adminId: input.adminId,
				action: 'sync.defaults.updated',
				entity: 'app_defaults',
				entityId: input.appId,
				before: null,
				after: null,
				reason: 'Actualización de predeterminados'
			},
			deps.audit
		);
	});
	deps.logger.emit('sync.defaults.updated', {});
}

/** Vista previa de la copia: categorías y elementos del documento propio de la cuenta (BE-FR-42 CA3). */
export function previewCopyAsDefaults(
	deps: SyncDeps,
	input: { readonly userId: string; readonly appId: string }
): PreviewCategory[] {
	const { schema } = schemaAndLimit(deps, input.appId);
	const stored = immediateTransaction(deps.db, (tx) => findDocument(tx, input.userId, input.appId));
	if (stored === undefined || !isRecord(stored.data)) return [];
	return previewCopy(schema, stored.data);
}

/** Copia lo seleccionado del documento propio como predeterminados, con auditoría (BE-FR-42 CA4). */
export function applyCopyAsDefaults(
	deps: SyncDeps,
	input: {
		readonly adminId: string;
		readonly userId: string;
		readonly appId: string;
		readonly selection: readonly Selection[];
	}
): void {
	const { schema, maxBytes } = schemaAndLimit(deps, input.appId);
	const stored = immediateTransaction(deps.db, (tx) => findDocument(tx, input.userId, input.appId));
	if (stored === undefined || !isRecord(stored.data)) {
		throw new AppError('VALIDATION_ERROR', { field: 'selection' });
	}
	const copied = applyCopy(schema, stored.data, input.selection);
	const verdict = validateDocument(schema, copied, maxBytes);
	if (!verdict.ok) throw new AppError('VALIDATION_ERROR', { field: verdict.field });
	const now = toEpochMs(deps.clock.now());
	immediateTransaction(deps.db, (tx) => {
		writeDefaults(tx, input.appId, copied, now);
		recordEntry(
			tx,
			{
				adminId: input.adminId,
				action: 'sync.defaults.copied',
				entity: 'app_defaults',
				entityId: input.appId,
				before: null,
				after: null,
				reason: 'Copia de datos propios como predeterminados'
			},
			deps.audit
		);
	});
	deps.logger.emit('sync.defaults.copied', {});
}
