// Bolsas de crédito de una cuenta para su ficha de administración (W35; T306). Solo lectura de `credit_buckets`: lo que queda, de dónde
// viene y cuándo caduca. El saldo lo calcula `getBalance`; esto solo muestra las bolsas.
import { desc, eq } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import { creditBuckets } from './schema';

export interface AdminBucketRow {
	readonly kind: string;
	readonly source: string;
	readonly initialMicro: number;
	readonly remainingMicro: number;
	readonly expiresAt: number | null;
	readonly simulated: boolean;
	readonly createdAt: number;
}

export function bucketsForAdmin(
	db: Pick<Db, 'select'>,
	userId: string,
	limit: number
): AdminBucketRow[] {
	return db
		.select({
			kind: creditBuckets.kind,
			source: creditBuckets.source,
			initialMicro: creditBuckets.initialMicro,
			remainingMicro: creditBuckets.remainingMicro,
			expiresAt: creditBuckets.expiresAt,
			simulated: creditBuckets.simulated,
			createdAt: creditBuckets.createdAt
		})
		.from(creditBuckets)
		.where(eq(creditBuckets.userId, userId))
		.orderBy(desc(creditBuckets.createdAt))
		.limit(limit)
		.all();
}
