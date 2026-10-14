// Repositorio de pagos (BE-FR-23, BE-FR-25 CA4, BE-FR-27; data-model 2.9; T223). La tabla `payments` la crea L02; aquí solo
// se lee y se escribe. Las transiciones de estado válidas las comprueba el servicio con el dominio; el repositorio no decide
// negocio. Toda búsqueda filtra por `user_id` cuando la compra es de un usuario concreto.
import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import type { Tx } from '$lib/server/db/tx';
import { toEurCents } from '$lib/shared/money';
import type { EpochMs } from '$lib/shared/time';
import { packs, payments } from './schema';

export type PaymentRow = typeof payments.$inferSelect;
export type PaymentStatus = PaymentRow['status'];

export function findByAttempt(
	db: Db | Tx,
	userId: string,
	attemptId: string
): PaymentRow | undefined {
	return db
		.select()
		.from(payments)
		.where(and(eq(payments.userId, userId), eq(payments.attemptId, attemptId)))
		.get();
}

export function findById(db: Db | Tx, id: string): PaymentRow | undefined {
	return db.select().from(payments).where(eq(payments.id, id)).get();
}

/** Búsqueda por la referencia del proveedor: la que llega en los eventos de webhook (BE-FR-23). */
export function findByProviderRef(db: Db | Tx, providerRef: string): PaymentRow | undefined {
	return db.select().from(payments).where(eq(payments.providerRef, providerRef)).get();
}

export function insertPayment(tx: Tx, row: typeof payments.$inferInsert): void {
	tx.insert(payments).values(row).run();
}

export function setStatus(
	tx: Tx,
	id: string,
	status: PaymentStatus,
	now: EpochMs,
	completedAt: EpochMs | null
): void {
	tx.update(payments).set({ status, completedAt, updatedAt: now }).where(eq(payments.id, id)).run();
}

/** Actualiza el importe ya devuelto; el CHECK de la tabla impide pasar de lo pagado. */
export function setRefundedEurCents(
	tx: Tx,
	id: string,
	refundedEurCents: number,
	now: EpochMs
): void {
	tx.update(payments)
		.set({ refundedEurCents: toEurCents(refundedEurCents), updatedAt: now })
		.where(eq(payments.id, id))
		.run();
}

/** Paquete por id, esté activo o no: el servicio decide si se puede vender (BE-FR-23). */
export function findPack(db: Db | Tx, id: string): typeof packs.$inferSelect | undefined {
	return db.select().from(packs).where(eq(packs.id, id)).get();
}

/** Paquetes a la venta, por orden de presentación (BE-FR-23). */
export function activePacks(db: Db | Tx): (typeof packs.$inferSelect)[] {
	return db.select().from(packs).where(eq(packs.active, true)).orderBy(asc(packs.sortOrder)).all();
}

/** Ids de las compras de una cuenta, para que `invoicing` liste sus facturas sin leer esta tabla (W30). */
export function paymentIdsOfUser(db: Db | Tx, userId: string): string[] {
	return db
		.select({ id: payments.id })
		.from(payments)
		.where(eq(payments.userId, userId))
		.all()
		.map((row) => row.id);
}

/** Marca la compra para factura completa (W30, BE-FR-75): la solicitud queda guardada hasta que se emita. */
export function markWantsFullInvoice(tx: Tx, paymentId: string): void {
	tx.update(payments).set({ wantsFullInvoice: true }).where(eq(payments.id, paymentId)).run();
}
