// Comprobación de activación contra el catálogo guardado (W41; T311). Lee `model_cache` y aplica las reglas puras de `domain/activation`.
// La usa la ruta de W41 antes de llamar a `apps.activateOperation`, que solo aplica el resultado.
import { eq } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import { checkActivation, type ActivationCheck, type ActivationNeeds } from './domain/activation';
import { modelCache } from './schema';

export function checkOperationActivatable(
	deps: { readonly db: Db },
	needs: ActivationNeeds
): ActivationCheck {
	const row =
		needs.model === null
			? undefined
			: deps.db.select().from(modelCache).where(eq(modelCache.modelId, needs.model)).get();
	const catalog =
		row === undefined
			? null
			: {
					modalities: row.modalities,
					supportedParameters: row.supportedParameters,
					hasPrice:
						Number.isFinite(row.pricing.inputPerMTokMicroUsd) &&
						Number.isFinite(row.pricing.outputPerMTokMicroUsd)
				};
	return checkActivation(needs, catalog);
}
