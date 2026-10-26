// Vigilancia de los modelos asignados (BE-FR-80, US12 escenario 3; T335). Puro: compara lo que las operaciones activas usan con
// el catálogo que llega del proveedor y con el catálogo anterior. Sin I/O: el servicio lee, llama a esta función y avisa.
// Un modelo asignado se considera retirado si ya no está en el catálogo o si ya no admite lo que la operación necesita. Un precio
// se considera cambiado si su variación supera `thresholdPpm` (en partes por millón: 200 000 = 20 %) respecto al catálogo anterior.
import type { CatalogEntry } from './activation';

export interface AssignedModel {
	readonly modelId: string;
	readonly needs: {
		readonly image_input: boolean;
		readonly structured_output: boolean;
		readonly tools: boolean;
	};
}

export interface PriceSnapshot {
	readonly inputPerMTokMicroUsd: number;
	readonly outputPerMTokMicroUsd: number;
}

export type ModelIssue =
	| { readonly kind: 'retired'; readonly modelId: string }
	| { readonly kind: 'price_changed'; readonly modelId: string; readonly changePpm: number };

/** Variación relativa en ppm entre dos precios; el mayor de entrada y salida. Sin precio anterior no hay variación. */
export function priceChangePpm(previous: PriceSnapshot, current: PriceSnapshot): number {
	const change = (before: number, after: number): number => {
		if (before === 0) return after === 0 ? 0 : 1_000_000_000;
		return Math.round((Math.abs(after - before) * 1_000_000) / before);
	};
	return Math.max(
		change(previous.inputPerMTokMicroUsd, current.inputPerMTokMicroUsd),
		change(previous.outputPerMTokMicroUsd, current.outputPerMTokMicroUsd)
	);
}

function retiredFor(model: AssignedModel, catalog: CatalogEntry | undefined): boolean {
	if (catalog === undefined) return true;
	if (model.needs.image_input && !catalog.modalities.includes('image')) return true;
	if (model.needs.structured_output && !catalog.supportedParameters.includes('response_format')) {
		return true;
	}
	return model.needs.tools && !catalog.supportedParameters.includes('tools');
}

/**
 * Problemas de los modelos asignados. `current` es el catálogo nuevo (modelo → entrada y precio), `previous` el anterior.
 * Un modelo sin catálogo anterior no tiene precio que comparar. Devuelve los problemas en el orden de `assigned`.
 */
export function detectAssignedModelIssues(input: {
	readonly assigned: readonly AssignedModel[];
	readonly current: ReadonlyMap<
		string,
		{ readonly catalog: CatalogEntry; readonly price: PriceSnapshot }
	>;
	readonly previous: ReadonlyMap<string, PriceSnapshot>;
	readonly thresholdPpm: number;
}): ModelIssue[] {
	const issues: ModelIssue[] = [];
	for (const model of input.assigned) {
		const now = input.current.get(model.modelId);
		if (retiredFor(model, now?.catalog)) {
			issues.push({ kind: 'retired', modelId: model.modelId });
			continue;
		}
		const before = input.previous.get(model.modelId);
		if (now === undefined || before === undefined) continue;
		const changePpm = priceChangePpm(before, now.price);
		if (changePpm > input.thresholdPpm) {
			issues.push({ kind: 'price_changed', modelId: model.modelId, changePpm });
		}
	}
	return issues;
}
