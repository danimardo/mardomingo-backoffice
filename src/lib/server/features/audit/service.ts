// Registro de acciones del administrador (BE-FR-55). `recordEntry` se llama dentro de la misma transacción que la
// acción auditada: si la acción falla, no queda entrada, y si la entrada no se puede escribir, tampoco la acción.
import type { Clock } from '$lib/server/adapters/clock/clock';
import type { Tx } from '$lib/server/db/tx';
import type { Logger } from '$lib/server/logging/logger';
import type { IdGenerator } from '$lib/server/shared/ids';
import { AppError } from '$lib/server/shared/errors';
import { AuditSnapshot } from './json-schemas';
import { insertAdminAudit } from './repository';

export interface AuditDeps {
	readonly clock: Clock;
	readonly ids: IdGenerator;
	readonly logger: Logger;
}

export interface AuditEntry {
	readonly adminId: string;
	/** Acción con el prefijo de su funcionalidad: `apps.settings.update`, `credits.adjust`… */
	readonly action: string;
	readonly entity: string;
	readonly entityId: string | null;
	readonly before: AuditSnapshot | null;
	readonly after: AuditSnapshot | null;
	readonly reason: string | null;
}

/** Valida una instantánea (solo campos cambiados, sin datos sensibles) antes de guardarla. */
function checkedSnapshot(snapshot: AuditSnapshot | null): AuditSnapshot | null {
	if (snapshot === null) return null;
	const result = AuditSnapshot.safeParse(snapshot);
	if (!result.success) throw new AppError('VALIDATION_ERROR', { field: 'audit' });
	return result.data;
}

/** Escribe la entrada dentro de `tx` y devuelve su id. */
export function recordEntry(tx: Tx, entry: AuditEntry, deps: AuditDeps): string {
	const id = deps.ids('aud');
	insertAdminAudit(tx, {
		id,
		adminId: entry.adminId,
		action: entry.action,
		entity: entry.entity,
		entityId: entry.entityId,
		before: checkedSnapshot(entry.before),
		after: checkedSnapshot(entry.after),
		reason: entry.reason,
		createdAt: deps.clock.now()
	});
	deps.logger.emit('audit.entry.recorded', { action: entry.action, entity: entry.entity });
	return id;
}
