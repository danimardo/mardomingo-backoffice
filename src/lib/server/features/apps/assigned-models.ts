// Modelos asignados a las operaciones activas de las apps activas (BE-FR-80; T335). Lo lee `ai` para vigilar que sigan
// disponibles y con el precio esperado. Solo lectura.
import { and, eq, isNotNull } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import { apps, appOperations } from './schema';

export interface AssignedModelRow {
	readonly operationKey: string;
	readonly modelId: string;
	readonly capabilities: {
		readonly image_input: boolean;
		readonly structured_output: boolean;
		readonly tools: boolean;
	};
}

export function assignedModelsOf(db: Pick<Db, 'select'>): AssignedModelRow[] {
	return db
		.select({
			operationKey: appOperations.key,
			modelId: appOperations.model,
			capabilities: appOperations.capabilities
		})
		.from(appOperations)
		.innerJoin(apps, eq(apps.id, appOperations.appId))
		.where(
			and(eq(apps.status, 'active'), eq(appOperations.active, true), isNotNull(appOperations.model))
		)
		.all()
		.flatMap((row) =>
			row.modelId === null
				? []
				: [{ operationKey: row.operationKey, modelId: row.modelId, capabilities: row.capabilities }]
		);
}
