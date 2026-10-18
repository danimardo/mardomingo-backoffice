// Edición de los parámetros seguros de una operación desde W41 (BE-FR-77; T311). Solo cambia tiempo máximo, tokens de salida,
// temperatura y coste máximo por petición. No cambia el tipo ni el modelo: cambiar el modelo obliga a volver a comprobar la activación
// (`activateOperation`). Valida por rango, audita en la misma transacción y no toca el estado de activación.
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { immediateTransaction } from '$lib/server/db/tx';
import { recordEntry } from '$lib/server/features/audit';
import { AppError } from '$lib/server/shared/errors';
import { toMicro } from '$lib/shared/money';
import type { AppsDeps } from './service';
import { appOperations } from './schema';

export const OperationSafeSettings = z.strictObject({
	timeoutMs: z.number().int().min(1000).max(300_000),
	maxOutputTokens: z.number().int().min(1).max(200_000).nullable(),
	temperatureMilli: z.number().int().min(0).max(2000),
	maxCostMicro: z.number().int().positive()
});
export type OperationSafeSettings = z.infer<typeof OperationSafeSettings>;

/** Instantánea de auditoría. Sus claves no contienen «token» (la guarda de auditoría lo tomaría por un secreto). */
function snapshotOf(value: OperationSafeSettings | Record<keyof OperationSafeSettings, unknown>) {
	return {
		tiempoMaximoMs: value.timeoutMs,
		salidaMaxima: value.maxOutputTokens,
		temperaturaMilli: value.temperatureMilli,
		costeMaximoMicro: value.maxCostMicro
	};
}

export interface UpdateOperationSettingsInput {
	readonly actorId: string;
	readonly operationId: string;
	readonly settings: unknown;
	readonly reason: string;
}

export function updateOperationSettings(deps: AppsDeps, input: UpdateOperationSettingsInput): void {
	const parsed = OperationSafeSettings.safeParse(input.settings);
	if (!parsed.success) {
		throw new AppError('VALIDATION_ERROR', { field: 'settings' });
	}
	const next = parsed.data;
	const now = deps.clock.now();
	immediateTransaction(deps.db, (tx) => {
		const before = tx
			.select({
				timeoutMs: appOperations.timeoutMs,
				maxOutputTokens: appOperations.maxOutputTokens,
				temperatureMilli: appOperations.temperatureMilli,
				maxCostMicro: appOperations.maxCostMicro
			})
			.from(appOperations)
			.where(eq(appOperations.id, input.operationId))
			.get();
		if (before === undefined) throw new AppError('NOT_FOUND', { field: 'operation' });
		tx.update(appOperations)
			.set({
				timeoutMs: next.timeoutMs,
				maxOutputTokens: next.maxOutputTokens,
				temperatureMilli: next.temperatureMilli,
				maxCostMicro: toMicro(next.maxCostMicro),
				updatedAt: now
			})
			.where(eq(appOperations.id, input.operationId))
			.run();
		recordEntry(
			tx,
			{
				adminId: input.actorId,
				action: 'apps.operation.settings',
				entity: 'operation',
				entityId: input.operationId,
				before: snapshotOf(before),
				after: snapshotOf(next),
				reason: input.reason
			},
			{ clock: deps.clock, ids: deps.ids, logger: deps.logger }
		);
	});
	deps.logger.emit('apps.operation.updated', {});
}
