// Servicio de `sync` (BE-FR-39 a BE-FR-42, FR-064 a FR-068; T217). Documento por (cuenta, app) con revisión; escritura
// condicional con `If-Match`; predeterminados por app; copia de datos como predeterminados con auditoría. La comprobación
// de versión, mantenimiento y documentos legales va en las rutas: la arquitectura solo permite a `sync` depender de
// `apps` y `audit`.
import { createHash } from 'node:crypto';
import type { Clock } from '$lib/server/adapters/clock/clock';
import type { Db } from '$lib/server/db/client';
import { immediateTransaction, type Tx } from '$lib/server/db/tx';
import { recordEntry, type AuditDeps } from '$lib/server/features/audit';
import {
	getEffectiveConfig,
	syncSchemaOf,
	syncSchemaStampOf,
	type AppsDeps
} from '$lib/server/features/apps';
import type { Logger } from '$lib/server/logging/logger';
import { AppError } from '$lib/server/shared/errors';
import { toEpochMs, type EpochMs } from '$lib/shared/time';
import {
	applyCopy,
	previewCopy,
	type PreviewCategory,
	type Selection
} from './domain/copy-defaults';
import { canonicalJson, changedCategories, summarizeDefaults } from './domain/defaults-summary';
import {
	documentBytes,
	invalidCategories,
	keepValidCategories,
	validateDocument
} from './domain/document-schema';
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
import { cachedSyncSchema, storeSyncSchema } from './document-schema.cache';
import { pruneTombstones } from './domain/tombstones';
import { allDocuments } from './repository';

export interface SyncDeps {
	readonly db: Db;
	readonly clock: Clock;
	readonly logger: Logger;
	readonly apps: AppsDeps;
	readonly audit: AuditDeps;
}

const KB = 1024;

function schemaAndLimit(deps: SyncDeps, appId: string): { schema: SyncSchema; maxBytes: number } {
	// La fecha de la app decide si el esquema cacheado sirve; si no, se relee y se guarda con esa misma fecha.
	const stamp = syncSchemaStampOf(deps.apps, appId);
	let schema = cachedSyncSchema(appId, stamp);
	if (schema === undefined) {
		schema = syncSchemaOf(deps.apps, appId);
		storeSyncSchema(appId, stamp, schema);
	}
	const maxKb = getEffectiveConfig(deps.apps, { appId }).settings.max_sync_doc_kb;
	return { schema, maxBytes: maxKb * KB };
}

function isRecord(value: unknown): value is SyncData {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Mensaje de los _triggers_ de la migración 0019: la cuenta ya está borrada (C-43). */
const DELETED_ACCOUNT_ABORT = 'sync_documents_user_deleted';

/**
 * Ejecuta una transacción de `sync_documents` y traduce el aborto de los _triggers_ de cuenta borrada (BE-FR-07 CA1, C-43):
 * una petición que pasó la sesión antes de que se confirmara el borrado no puede recrear el documento. Para el cliente es una
 * sesión que ya no existe (`UNAUTHENTICATED`), como en su siguiente petición.
 */
function documentTransaction<T>(deps: SyncDeps, run: (tx: Tx) => T): T {
	try {
		return immediateTransaction(deps.db, run);
	} catch (cause) {
		if (isDeletedAccountAbort(cause)) {
			throw new AppError('UNAUTHENTICATED', { reason: 'account_deleted' });
		}
		throw cause;
	}
}

function isDeletedAccountAbort(cause: unknown): boolean {
	return cause instanceof Error && cause.message === DELETED_ACCOUNT_ABORT;
}

/** Escritura de la limpieza diaria: el documento de una cuenta borrada se omite (no debería existir; C-43) sin parar la tarea. */
function writeUnlessDeleted(deps: SyncDeps, run: (tx: Tx) => boolean): boolean {
	try {
		return immediateTransaction(deps.db, run);
	} catch (cause) {
		if (isDeletedAccountAbort(cause)) return false;
		throw cause;
	}
}

/**
 * Lee el documento de la cuenta y, si no existe, lo siembra con los predeterminados (una sola vez, BE-FR-40). Solo se
 * siembran las categorías que admite el esquema vigente (C-45): un predeterminado que un cambio de W40 dejó fuera no llega a
 * la cuenta, que si no recibiría un documento que el propio servidor rechaza al reenviarlo.
 */
function documentOrSeed(
	tx: Tx,
	deps: SyncDeps,
	input: { readonly userId: string; readonly appId: string; readonly schema: SyncSchema },
	now: EpochMs
): { readonly revision: number; readonly data: SyncData } {
	const { userId, appId } = input;
	const stored = findDocument(tx, userId, appId);
	if (stored !== undefined) {
		if (!isRecord(stored.data)) {
			deps.logger.emit('sync.document.corrupt', {});
			throw new AppError('INTERNAL_ERROR', { reason: 'sync_document_corrupt' });
		}
		return { revision: stored.revision, data: stored.data };
	}
	const seeded = seedDocumentFrom(keepValidCategories(input.schema, findDefaults(tx, appId) ?? {}));
	insertDocument(tx, { userId, appId, data: seeded.data, now });
	deps.logger.emit('sync.document.seeded', {});
	return seeded;
}

export function getSyncDocument(
	deps: SyncDeps,
	input: { readonly userId: string; readonly appId: string }
): { readonly revision: number; readonly data: SyncData } {
	const started = performance.now();
	const { schema } = schemaAndLimit(deps, input.appId);
	const now = toEpochMs(deps.clock.now());
	const document = documentTransaction(deps, (tx) =>
		documentOrSeed(tx, deps, { ...input, schema }, now)
	);
	deps.logger.emit('sync.document.read', { durationMs: Math.round(performance.now() - started) });
	return document;
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
	const started = performance.now();
	const { schema, maxBytes } = schemaAndLimit(deps, input.appId);
	const verdict = validateDocument(schema, input.data, maxBytes);
	if (!verdict.ok) {
		if (verdict.reason === 'too_large') {
			deps.logger.emit('sync.document.rejected', {
				reason: 'too_large',
				errorCode: 'PAYLOAD_TOO_LARGE'
			});
			throw new AppError('PAYLOAD_TOO_LARGE');
		}
		deps.logger.emit('sync.document.rejected', {
			reason: 'schema_invalid',
			errorCode: 'VALIDATION_ERROR'
		});
		throw new AppError('VALIDATION_ERROR', { field: verdict.field });
	}
	if (!isRecord(input.data)) throw new AppError('VALIDATION_ERROR', { field: 'data' });
	const data = input.data;
	const now = toEpochMs(deps.clock.now());

	const result = documentTransaction(deps, (tx) => {
		const current = documentOrSeed(tx, deps, { ...input, schema }, now);
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
			deps.logger.emit('sync.document.rejected', {
				reason: 'revision_conflict',
				errorCode: 'SYNC_CONFLICT'
			});
			throw new AppError('SYNC_CONFLICT');
		}
		return { revision: current.revision + 1 };
	});
	deps.logger.emit('sync.document.written', {
		durationMs: Math.round(performance.now() - started)
	});
	return result;
}

/**
 * Elimina las marcas de borrado caducadas de cada documento (FR-064, H-27; T338). Solo escribe los documentos que cambian,
 * con la escritura condicional de siempre: si la revisión cambió mientras tanto, se omite y la siguiente ejecución lo
 * retoma. Cada documento que cambia sube su `revision`, para que ningún cliente sobrescriba sin releer. Devuelve cuántos
 * documentos han cambiado.
 */
export function purgeTombstones(deps: SyncDeps): number {
	const now = toEpochMs(deps.clock.now());
	const rows = immediateTransaction(deps.db, (tx) => allDocuments(tx));
	let changed = 0;
	let removed = 0;
	for (const row of rows) {
		if (!isRecord(row.data)) continue;
		const { schema } = schemaAndLimit(deps, row.appId);
		const pruned = pruneTombstones(schema, row.data, now);
		if (pruned.removed === 0) continue;
		const written = writeUnlessDeleted(deps, (tx) =>
			replaceIfRevision(tx, {
				userId: row.userId,
				appId: row.appId,
				expectedRevision: row.revision,
				data: pruned.data,
				now
			})
		);
		if (written) {
			changed += 1;
			removed += pruned.removed;
		}
	}
	if (removed > 0) deps.logger.emit('sync.tombstones.purged', { count: removed });
	return changed;
}

export function getDefaults(deps: SyncDeps, appId: string): SyncData {
	return immediateTransaction(deps.db, (tx) => findDefaults(tx, appId) ?? {});
}

/**
 * Categorías de los predeterminados que el esquema vigente de la app ya no admite (C-45): W40 las avisa tras un cambio del
 * esquema, y la siembra las omite. Vacío si los predeterminados encajan.
 */
export function staleDefaultCategories(deps: SyncDeps, appId: string): string[] {
	const { schema } = schemaAndLimit(deps, appId);
	return invalidCategories(schema, getDefaults(deps, appId));
}

/** El motivo es obligatorio en toda acción auditada del administrador (BE-FR-55, `contracts/web-routes.md` 1.4; C-41). */
function requireReason(reason: string): string {
	const trimmed = reason.trim();
	if (trimmed === '') throw new AppError('VALIDATION_ERROR', { field: 'reason' });
	return trimmed;
}

/** Instantánea sin contenido de unos predeterminados (C-41): categorías, elementos y SHA-256 del JSON canónico. */
function snapshotOf(schema: SyncSchema, data: SyncData) {
	return {
		...summarizeDefaults(schema, data),
		sha256: createHash('sha256').update(canonicalJson(data), 'utf8').digest('hex')
	};
}

/**
 * Escribe los predeterminados y su auditoría en la misma transacción. `before` y `after` resumen los dos documentos sin su
 * contenido, y `after.changed` nombra las categorías cambiadas (BE-FR-55; decisión del propietario de C-41).
 */
function writeAuditedDefaults(
	tx: Tx,
	deps: SyncDeps,
	input: {
		readonly adminId: string;
		readonly appId: string;
		readonly action: 'sync.defaults.updated' | 'sync.defaults.copied';
		readonly schema: SyncSchema;
		readonly previous: SyncData | undefined;
		readonly next: SyncData;
		readonly reason: string;
		readonly now: EpochMs;
	}
): void {
	writeDefaults(tx, input.appId, input.next, input.now);
	recordEntry(
		tx,
		{
			adminId: input.adminId,
			action: input.action,
			entity: 'app_defaults',
			entityId: input.appId,
			before: input.previous === undefined ? null : snapshotOf(input.schema, input.previous),
			after: {
				...snapshotOf(input.schema, input.next),
				changed: changedCategories(input.previous ?? {}, input.next)
			},
			reason: input.reason
		},
		deps.audit
	);
}

/** Cambia los predeterminados (BE-FR-42): no toca ninguna cuenta (CA1) y deja auditoría con su motivo (BE-FR-55). */
export function updateDefaults(
	deps: SyncDeps,
	input: {
		readonly adminId: string;
		readonly appId: string;
		readonly data: unknown;
		readonly reason: string;
	}
): void {
	const reason = requireReason(input.reason);
	const { schema, maxBytes } = schemaAndLimit(deps, input.appId);
	const verdict = validateDocument(schema, input.data, maxBytes);
	if (!verdict.ok) throw new AppError('VALIDATION_ERROR', { field: verdict.field });
	if (!isRecord(input.data)) throw new AppError('VALIDATION_ERROR', { field: 'data' });
	const data = input.data;
	const now = toEpochMs(deps.clock.now());
	immediateTransaction(deps.db, (tx) => {
		writeAuditedDefaults(tx, deps, {
			adminId: input.adminId,
			appId: input.appId,
			action: 'sync.defaults.updated',
			schema,
			previous: findDefaults(tx, input.appId),
			next: data,
			reason,
			now
		});
	});
	deps.logger.emit('sync.defaults.updated', { count: Object.keys(data).length });
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

/**
 * Copia lo seleccionado del documento propio como predeterminados, con auditoría (BE-FR-42 CA3–CA4). Solo sustituye las
 * categorías con algún elemento copiado y conserva las demás tal como estaban (C-40); si la selección no casa con nada (una
 * vista previa caducada), lanza `NOTHING_SELECTED` sin escribir ni auditar.
 */
export function applyCopyAsDefaults(
	deps: SyncDeps,
	input: {
		readonly adminId: string;
		readonly userId: string;
		readonly appId: string;
		readonly selection: readonly Selection[];
		readonly reason: string;
	}
): void {
	const reason = requireReason(input.reason);
	const { schema, maxBytes } = schemaAndLimit(deps, input.appId);
	const stored = immediateTransaction(deps.db, (tx) => findDocument(tx, input.userId, input.appId));
	if (stored === undefined || !isRecord(stored.data)) {
		throw new AppError('VALIDATION_ERROR', { field: 'selection' });
	}
	const copied = applyCopy(schema, stored.data, input.selection);
	if (Object.keys(copied).length === 0) throw new AppError('NOTHING_SELECTED');
	const verdict = validateDocument(schema, copied, maxBytes);
	if (!verdict.ok) throw new AppError('VALIDATION_ERROR', { field: verdict.field });
	const now = toEpochMs(deps.clock.now());
	immediateTransaction(deps.db, (tx) => {
		// Las categorías no copiadas se conservan aunque el esquema vigente ya no las admita: W40 lo avisa y la siembra las
		// omite (C-45); aquí solo se sustituye lo seleccionado.
		const previous = findDefaults(tx, input.appId);
		const next = { ...previous, ...copied };
		if (documentBytes(next) > maxBytes) throw new AppError('PAYLOAD_TOO_LARGE');
		writeAuditedDefaults(tx, deps, {
			adminId: input.adminId,
			appId: input.appId,
			action: 'sync.defaults.copied',
			schema,
			previous,
			next,
			reason,
			now
		});
	});
	deps.logger.emit('sync.defaults.copied', { count: Object.keys(copied).length });
}
