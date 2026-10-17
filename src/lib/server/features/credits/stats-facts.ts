// Saldo anulado por el borrado de cuentas en un periodo (BE-FR-07 CA4, D-15; T318). Solo lectura de `credit_movements`: los
// movimientos `forfeit` tienen importe negativo; se devuelven en positivo, con su día civil de Madrid.
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import { civilDateOf } from '$lib/shared/dates';
import { toEpochMs } from '$lib/shared/time';
import { creditMovements } from './schema';

export interface ForfeitFact {
	readonly date: string;
	readonly micro: number;
}

export function forfeitsBetween(
	db: Pick<Db, 'select'>,
	input: { readonly fromMs: number; readonly toMs: number }
): ForfeitFact[] {
	return db
		.select({ createdAt: creditMovements.createdAt, amountMicro: creditMovements.amountMicro })
		.from(creditMovements)
		.where(
			and(
				eq(creditMovements.type, 'forfeit'),
				gte(creditMovements.createdAt, toEpochMs(input.fromMs)),
				lte(creditMovements.createdAt, toEpochMs(input.toMs))
			)
		)
		.orderBy(asc(creditMovements.createdAt))
		.all()
		.map((row) => ({
			date: civilDateOf(toEpochMs(row.createdAt)),
			micro: 0 - row.amountMicro
		}));
}
