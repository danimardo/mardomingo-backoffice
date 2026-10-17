// Lectura de la auditoría para el panel de administración (BE-FR-55; W46–W47; T303). Solo lectura: no hay ninguna vía para
// editar ni borrar una entrada (la inmutabilidad la imponen los triggers de la migración).
import { and, count, desc, eq, gte, lte } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import type { EpochMs } from '$lib/shared/time';
import { adminAudit } from './schema';

export const AUDIT_PAGE_SIZE = 25;

export interface AuditFilter {
	readonly entity: string | null;
	readonly action: string | null;
	readonly fromMs: EpochMs | null;
	readonly toMs: EpochMs | null;
	readonly page: number;
}

export interface AuditListRow {
	readonly id: string;
	readonly adminId: string;
	readonly action: string;
	readonly entity: string;
	readonly entityId: string | null;
	readonly reason: string | null;
	readonly createdAt: EpochMs;
}

export interface AuditPage {
	readonly rows: readonly AuditListRow[];
	readonly total: number;
	readonly pagination: {
		readonly page: number;
		readonly hasPrevious: boolean;
		readonly hasNext: boolean;
	};
}

function conditionsOf(filter: Omit<AuditFilter, 'page'>) {
	const conditions = [];
	if (filter.entity !== null) conditions.push(eq(adminAudit.entity, filter.entity));
	if (filter.action !== null) conditions.push(eq(adminAudit.action, filter.action));
	if (filter.fromMs !== null) conditions.push(gte(adminAudit.createdAt, filter.fromMs));
	if (filter.toMs !== null) conditions.push(lte(adminAudit.createdAt, filter.toMs));
	return conditions;
}

/** Entradas de la auditoría, de la más reciente a la más antigua, con filtros por entidad, acción y día. */
export function auditPage(db: Db, filter: AuditFilter): AuditPage {
	const conditions = conditionsOf(filter);
	const where = conditions.length > 0 ? and(...conditions) : undefined;
	const found = db
		.select({
			id: adminAudit.id,
			adminId: adminAudit.adminId,
			action: adminAudit.action,
			entity: adminAudit.entity,
			entityId: adminAudit.entityId,
			reason: adminAudit.reason,
			createdAt: adminAudit.createdAt
		})
		.from(adminAudit)
		.where(where)
		.orderBy(desc(adminAudit.createdAt), desc(adminAudit.id))
		.limit(AUDIT_PAGE_SIZE + 1)
		.offset((filter.page - 1) * AUDIT_PAGE_SIZE)
		.all();
	const total = db.select({ total: count() }).from(adminAudit).where(where).get()?.total ?? 0;
	return {
		rows: found.slice(0, AUDIT_PAGE_SIZE),
		total,
		pagination: {
			page: filter.page,
			hasPrevious: filter.page > 1,
			hasNext: found.length > AUDIT_PAGE_SIZE
		}
	};
}

/** Una entrada completa, con sus instantáneas anterior y nueva (W47). Nulo si no existe. */
export function auditEntry(db: Db, id: string) {
	return db.select().from(adminAudit).where(eq(adminAudit.id, id)).get() ?? null;
}
