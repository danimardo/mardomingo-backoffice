// Escritura de `admin_audit`. Solo inserta: la inmutabilidad la imponen los triggers de la migración (T075).
import type { Tx } from '$lib/server/db/tx';
import { adminAudit } from './schema';

export type AdminAuditRow = typeof adminAudit.$inferInsert;

export function insertAdminAudit(tx: Tx, row: AdminAuditRow): void {
	tx.insert(adminAudit).values(row).run();
}
