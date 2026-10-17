// Repositorio de `fx_rates` (data-model 2.5; T141): solo inserción y lectura. El histórico no se edita; la vigencia es la
// fila con mayor `effective_from` ≤ ahora (`domain/fx.ts`). Las restricciones de la tabla las prueba `fx.int.test.ts`.
import { desc, eq, lte } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import type { Tx } from '$lib/server/db/tx';
import { toCivilDate, toEpochMs } from '$lib/shared/time';
import { toPpm } from '$lib/shared/money';
import { fxRates } from './schema';

export interface FxRecord {
	readonly id: string;
	readonly usdEurPpm: number;
	readonly source: 'ecb' | 'manual';
	readonly ecbRatePpm: number | null;
	readonly ecbDate: string | null;
	readonly bufferPpm: number | null;
	readonly effectiveFrom: number;
	readonly createdBy: string | null;
}

export interface NewFxRecord {
	readonly id: string;
	readonly usdEurPpm: number;
	readonly source: 'ecb' | 'manual';
	readonly ecbRatePpm: number | null;
	readonly ecbDate: string | null;
	readonly bufferPpm: number | null;
	readonly effectiveFrom: number;
	readonly createdBy: string | null;
	readonly createdAt: number;
}

export function insertFxRecord(tx: Tx, row: NewFxRecord): void {
	tx.insert(fxRates)
		.values({
			id: row.id,
			usdEurPpm: toPpm(row.usdEurPpm),
			source: row.source,
			ecbRatePpm: row.ecbRatePpm === null ? null : toPpm(row.ecbRatePpm),
			ecbDate: row.ecbDate === null ? null : toCivilDate(row.ecbDate),
			bufferPpm: row.bufferPpm === null ? null : toPpm(row.bufferPpm),
			effectiveFrom: toEpochMs(row.effectiveFrom),
			createdBy: row.createdBy,
			createdAt: toEpochMs(row.createdAt)
		})
		.run();
}

function toRecord(row: typeof fxRates.$inferSelect): FxRecord {
	return {
		id: row.id,
		usdEurPpm: row.usdEurPpm,
		source: row.source,
		ecbRatePpm: row.ecbRatePpm,
		ecbDate: row.ecbDate,
		bufferPpm: row.bufferPpm,
		effectiveFrom: row.effectiveFrom,
		createdBy: row.createdBy
	};
}

/** Filas ya en vigor, de la más reciente a la más antigua. */
export function fxRowsInForce(db: Db | Tx, now: number): FxRecord[] {
	return db
		.select()
		.from(fxRates)
		.where(lte(fxRates.effectiveFrom, toEpochMs(now)))
		.orderBy(desc(fxRates.effectiveFrom))
		.all()
		.map(toRecord);
}

/** Última observación del BCE guardada (base de la alerta de tipo de cambio sin actualizar). */
export function lastEcbRecord(db: Db | Tx): FxRecord | undefined {
	const row = db
		.select()
		.from(fxRates)
		.where(eq(fxRates.source, 'ecb'))
		.orderBy(desc(fxRates.effectiveFrom))
		.limit(1)
		.get();
	return row === undefined ? undefined : toRecord(row);
}

/** Tipo USD→EUR (en ppm) que se guardó con una fila de `fx_rates`, o nulo si no existe. Solo lectura, para la contabilidad (T316). */
export function usdEurPpmOfRate(db: Db | Tx, fxRateId: string): number | null {
	const row = db
		.select({ usdEurPpm: fxRates.usdEurPpm })
		.from(fxRates)
		.where(eq(fxRates.id, fxRateId))
		.get();
	return row?.usdEurPpm ?? null;
}
