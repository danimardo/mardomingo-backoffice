// Pagos de una cuenta para la ficha de administración (W35; T306). Solo lectura de `payments`: la fila del pago, sin datos de
// tarjeta ni del proveedor. Las devoluciones y las acciones siguen en W37.
import { desc, eq } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import { payments } from './schema';

export interface AdminPaymentRow {
	readonly id: string;
	readonly status: string;
	readonly amountEurCents: number;
	readonly simulated: boolean;
	readonly createdAt: number;
}

/** Los pagos más recientes de la cuenta, para la ficha de W35. */
export function paymentsForAdmin(
	db: Pick<Db, 'select'>,
	userId: string,
	limit: number
): AdminPaymentRow[] {
	return db
		.select({
			id: payments.id,
			status: payments.status,
			amountEurCents: payments.amountEurCents,
			simulated: payments.simulated,
			createdAt: payments.createdAt
		})
		.from(payments)
		.where(eq(payments.userId, userId))
		.orderBy(desc(payments.createdAt))
		.limit(limit)
		.all();
}
