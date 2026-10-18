// Activación de una operación de IA (W41; BE-FR-77 CA1–CA3, BE-FR-78; T311). La comprobación de si la operación puede activarse
// vive en `ai` (`checkOperationActivatable`), que sí conoce el catálogo de modelos. Aquí solo se aplica su resultado: si rechaza,
// no se toca la operación y se emite `apps.operation.activation_rejected`; si acepta, se activa y se audita en la misma transacción.
import { eq } from 'drizzle-orm';
import { immediateTransaction } from '$lib/server/db/tx';
import { recordEntry } from '$lib/server/features/audit';
import { AppError } from '$lib/server/shared/errors';
import type { AppsDeps } from './service';
import { appOperations } from './schema';

export type ActivationRejection = 'no_model' | 'model_unknown' | 'model_incapable' | 'no_price';

/** Resultado de `ai.checkOperationActivatable`. */
export type ActivationCheck =
	{ readonly ok: true } | { readonly ok: false; readonly reason: ActivationRejection };

export interface ActivateOperationInput {
	readonly actorId: string;
	readonly operationId: string;
	readonly check: ActivationCheck;
	readonly reason: string;
}

/** Activa la operación si la comprobación lo permite. Rechaza sin cambios y deja rastro si no. */
export function activateOperation(deps: AppsDeps, input: ActivateOperationInput): void {
	if (!input.check.ok) {
		deps.logger.emit('apps.operation.activation_rejected', { reason: input.check.reason });
		throw new AppError('VALIDATION_ERROR', { field: 'activation', reason: input.check.reason });
	}
	const now = deps.clock.now();
	immediateTransaction(deps.db, (tx) => {
		const before = tx
			.select({ active: appOperations.active })
			.from(appOperations)
			.where(eq(appOperations.id, input.operationId))
			.get();
		if (before === undefined) throw new AppError('NOT_FOUND', { field: 'operation' });
		tx.update(appOperations)
			.set({ active: true, updatedAt: now })
			.where(eq(appOperations.id, input.operationId))
			.run();
		recordEntry(
			tx,
			{
				adminId: input.actorId,
				action: 'apps.operation.activate',
				entity: 'operation',
				entityId: input.operationId,
				before: { active: before.active },
				after: { active: true },
				reason: input.reason
			},
			{ clock: deps.clock, ids: deps.ids, logger: deps.logger }
		);
	});
	deps.logger.emit('apps.operation.activated', {});
}
