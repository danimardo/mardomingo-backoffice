// Coste de IA de un periodo para la exportación contable (BE-FR-76; T316). Solo lectura de `ai_operations`: cada operación con coste,
// con su día civil de Madrid, su proveedor, su app y el id del tipo de cambio con el que se hizo. La conversión a euros la hace la
// capa que llama, con el tipo de `pricing` (no se lee otra tabla aquí).
import { and, asc, gt, gte, lte } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import { civilDateOf } from '$lib/shared/dates';
import { toEpochMs } from '$lib/shared/time';
import { toMicroUsd } from '$lib/shared/money';
import { aiOperations } from './schema';

export interface OperationCostFact {
	readonly date: string;
	readonly provider: string;
	readonly appId: string;
	readonly usdMicro: number;
	readonly fxRateId: string | null;
}

export function operationCostFactsBetween(
	db: Pick<Db, 'select'>,
	input: { readonly fromMs: number; readonly toMs: number }
): OperationCostFact[] {
	return db
		.select({
			createdAt: aiOperations.createdAt,
			provider: aiOperations.provider,
			appId: aiOperations.appId,
			costMicroUsd: aiOperations.costMicroUsd,
			fxRateId: aiOperations.fxRateId
		})
		.from(aiOperations)
		.where(
			and(
				gt(aiOperations.costMicroUsd, toMicroUsd(0)),
				gte(aiOperations.createdAt, toEpochMs(input.fromMs)),
				lte(aiOperations.createdAt, toEpochMs(input.toMs))
			)
		)
		.orderBy(asc(aiOperations.createdAt))
		.all()
		.map((row) => ({
			date: civilDateOf(toEpochMs(row.createdAt)),
			provider: row.provider ?? 'none',
			appId: row.appId,
			usdMicro: row.costMicroUsd,
			fxRateId: row.fxRateId
		}));
}
