// Acceso a las tablas de `invoicing` (T238). Solo lee y escribe filas; las reglas viven en `service.ts`. Las facturas son
// inmutables en base de datos (triggers de la migración 0011): aquí solo hay inserciones y lecturas.
import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import type { Tx } from '$lib/server/db/tx';
import type { EpochMs } from '$lib/shared/time';
import { billingProfiles, invoices } from './schema';

export type InvoiceRow = typeof invoices.$inferSelect;
export type BillingProfileRow = typeof billingProfiles.$inferSelect;

export function billingProfileOf(db: Db | Tx, userId: string): BillingProfileRow | undefined {
	return db.select().from(billingProfiles).where(eq(billingProfiles.userId, userId)).get();
}

export function upsertBillingProfile(
	tx: Tx,
	row: Omit<BillingProfileRow, 'createdAt' | 'updatedAt'>,
	now: EpochMs
): void {
	tx.insert(billingProfiles)
		.values({ ...row, createdAt: now, updatedAt: now })
		.onConflictDoUpdate({
			target: billingProfiles.userId,
			set: {
				kind: row.kind,
				legalName: row.legalName,
				taxId: row.taxId,
				address: row.address,
				postalCode: row.postalCode,
				city: row.city,
				country: row.country,
				updatedAt: now
			}
		})
		.run();
}

export function invoiceByIssueKey(db: Db | Tx, issueKey: string): InvoiceRow | undefined {
	return db.select().from(invoices).where(eq(invoices.issueKey, issueKey)).get();
}

export function invoiceById(db: Db | Tx, id: string): InvoiceRow | undefined {
	return db.select().from(invoices).where(eq(invoices.id, id)).get();
}

/** Factura inicial (no rectificativa) de una compra: la que rectifican los reembolsos y contracargos. */
export function initialInvoiceOf(db: Db | Tx, paymentId: string): InvoiceRow | undefined {
	return db
		.select()
		.from(invoices)
		.where(and(eq(invoices.paymentId, paymentId), ne(invoices.kind, 'corrective')))
		.get();
}

/** Facturas de las compras indicadas, de la más reciente a la más antigua (W30). */
export function invoicesOfPayments(db: Db | Tx, paymentIds: readonly string[]): InvoiceRow[] {
	if (paymentIds.length === 0) return [];
	return db
		.select()
		.from(invoices)
		.where(inArray(invoices.paymentId, [...paymentIds]))
		.orderBy(desc(invoices.issuedAt), desc(invoices.id))
		.all();
}

export function insertInvoice(tx: Tx, row: typeof invoices.$inferInsert): void {
	tx.insert(invoices).values(row).run();
}
