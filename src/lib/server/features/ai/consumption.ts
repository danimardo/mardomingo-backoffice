// Lectura paginada del consumo del panel (BE-FR-49.4; T263). Solo lee `ai_operations` (su dueña): el nombre de la app lo resuelve
// la ruta con `apps`. Sin contenido de los mensajes ni datos del proveedor.
import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import type { EpochMs } from '$lib/shared/time';
import { aiOperations } from './schema';

export const CONSUMPTION_PAGE_SIZE = 25;

export interface ConsumptionRow {
	readonly createdAt: EpochMs;
	readonly appId: string;
	readonly operation: string;
	readonly status: string;
	readonly chargedMicro: number;
}

export interface ConsumptionPage {
	readonly rows: readonly ConsumptionRow[];
	readonly pagination: {
		readonly page: number;
		readonly hasPrevious: boolean;
		readonly hasNext: boolean;
	};
}

export function consumptionPage(
	db: Db,
	input: {
		readonly userId: string;
		readonly fromMs: EpochMs | null;
		readonly toMs: EpochMs | null;
		readonly appId: string | null;
		readonly page: number;
		readonly order?: 'asc' | 'desc';
	}
): ConsumptionPage {
	const conditions = [eq(aiOperations.userId, input.userId)];
	if (input.fromMs !== null) conditions.push(gte(aiOperations.createdAt, input.fromMs));
	if (input.toMs !== null) conditions.push(lte(aiOperations.createdAt, input.toMs));
	if (input.appId !== null) conditions.push(eq(aiOperations.appId, input.appId));
	const byDate = input.order === 'asc' ? asc : desc;
	const found = db
		.select({
			createdAt: aiOperations.createdAt,
			appId: aiOperations.appId,
			operation: aiOperations.appOperationId,
			status: aiOperations.status,
			chargedMicro: aiOperations.chargedMicro
		})
		.from(aiOperations)
		.where(and(...conditions))
		.orderBy(byDate(aiOperations.createdAt), byDate(aiOperations.id))
		.limit(CONSUMPTION_PAGE_SIZE + 1)
		.offset((input.page - 1) * CONSUMPTION_PAGE_SIZE)
		.all();
	return {
		rows: found.slice(0, CONSUMPTION_PAGE_SIZE).map((row) => ({
			createdAt: row.createdAt,
			appId: row.appId,
			operation: row.operation,
			status: row.status,
			chargedMicro: row.chargedMicro
		})),
		pagination: {
			page: input.page,
			hasPrevious: input.page > 1,
			hasNext: found.length > CONSUMPTION_PAGE_SIZE
		}
	};
}
