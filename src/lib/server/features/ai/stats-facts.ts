// Operaciones de IA de un periodo para las estadísticas (BE-FR-54; T318–T319). Solo lectura de `ai_operations`, con lo que cada métrica
// necesita: estado, coste del proveedor, lo cobrado, lo absorbido y por qué, si usó respaldo y si se truncó. La conversión a euros la
// hace la capa que llama, con el tipo de `pricing`.
import { and, asc, gte, lte } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import { civilDateOf } from '$lib/shared/dates';
import { toEpochMs } from '$lib/shared/time';
import { aiOperations } from './schema';

export interface OperationStatsFact {
	readonly date: string;
	readonly appId: string;
	readonly status: string;
	readonly costMicroUsd: number;
	readonly chargedMicro: number;
	readonly absorbedMicro: number;
	readonly absorbedReason: string | null;
	readonly usedFallback: boolean;
	readonly truncated: boolean;
	readonly fxRateId: string | null;
}

export function operationStatsBetween(
	db: Pick<Db, 'select'>,
	input: { readonly fromMs: number; readonly toMs: number }
): OperationStatsFact[] {
	return db
		.select({
			createdAt: aiOperations.createdAt,
			appId: aiOperations.appId,
			status: aiOperations.status,
			costMicroUsd: aiOperations.costMicroUsd,
			chargedMicro: aiOperations.chargedMicro,
			absorbedMicro: aiOperations.absorbedMicro,
			absorbedReason: aiOperations.absorbedReason,
			usedFallback: aiOperations.usedFallback,
			truncated: aiOperations.truncated,
			fxRateId: aiOperations.fxRateId
		})
		.from(aiOperations)
		.where(
			and(
				gte(aiOperations.createdAt, toEpochMs(input.fromMs)),
				lte(aiOperations.createdAt, toEpochMs(input.toMs))
			)
		)
		.orderBy(asc(aiOperations.createdAt))
		.all()
		.map((row) => ({
			date: civilDateOf(toEpochMs(row.createdAt)),
			appId: row.appId,
			status: row.status,
			costMicroUsd: row.costMicroUsd,
			chargedMicro: row.chargedMicro,
			absorbedMicro: row.absorbedMicro,
			absorbedReason: row.absorbedReason,
			usedFallback: row.usedFallback,
			truncated: row.truncated,
			fxRateId: row.fxRateId
		}));
}
