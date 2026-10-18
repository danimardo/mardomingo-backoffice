// Reglas de activación de una operación de IA (W41; BE-FR-77 CA1–CA3; T311). Función pura: recibe lo que la operación pide y lo que
// el catálogo guardado dice del modelo, y decide. Sin acceso a base de datos. La transcripción no usa modelo de chat (ver schema).
export type ActivationRejection = 'no_model' | 'model_unknown' | 'model_incapable' | 'no_price';

export interface ActivationNeeds {
	readonly kind: 'chat' | 'transcription' | 'image';
	readonly model: string | null;
	readonly capabilities: {
		readonly image_input: boolean;
		readonly structured_output: boolean;
		readonly tools: boolean;
	};
	readonly estimatedMaxCostMicroUsd: number | null;
}

/** Lo que el catálogo guardado (`model_cache`) sabe del modelo. `null` si el modelo no está en el catálogo. */
export interface CatalogEntry {
	readonly modalities: readonly string[];
	readonly supportedParameters: readonly string[];
	readonly hasPrice: boolean;
}

export type ActivationCheck =
	{ readonly ok: true } | { readonly ok: false; readonly reason: ActivationRejection };

/** Comprueba en orden: modelo, catálogo, capacidades y precio. El coste máximo estimado sustituye al precio del catálogo. */
export function checkActivation(
	needs: ActivationNeeds,
	catalog: CatalogEntry | null
): ActivationCheck {
	if (needs.kind === 'transcription') return { ok: true };
	if (needs.model === null) return { ok: false, reason: 'no_model' };
	if (catalog === null) return { ok: false, reason: 'model_unknown' };
	if (!capabilitiesSupported(needs.capabilities, catalog)) {
		return { ok: false, reason: 'model_incapable' };
	}
	if (needs.estimatedMaxCostMicroUsd === null && !catalog.hasPrice) {
		return { ok: false, reason: 'no_price' };
	}
	return { ok: true };
}

function capabilitiesSupported(
	capabilities: ActivationNeeds['capabilities'],
	catalog: CatalogEntry
): boolean {
	if (capabilities.image_input && !catalog.modalities.includes('image')) return false;
	if (capabilities.structured_output && !catalog.supportedParameters.includes('response_format')) {
		return false;
	}
	if (capabilities.tools && !catalog.supportedParameters.includes('tools')) return false;
	return true;
}
