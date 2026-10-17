// Conversión del coste de IA a euros para el informe contable (BE-FR-76; T316). Cada operación se convierte con el tipo de cambio con el
// que se hizo (`fx_rate_id`); la fórmula es micro-USD × ppm / 10¹⁰ = céntimos de euro. Una operación sin tipo conocido no se inventa:
// cuenta como sin convertir y se devuelve el recuento para que el informe lo diga.
import type { AiCostFact } from '$lib/server/features/invoicing';
import type { OperationCostFact } from '$lib/server/features/ai';

export interface AiCostsInEur {
	readonly costs: readonly AiCostFact[];
	readonly unconverted: number;
}

/** Céntimos de euro de un importe en micro-USD con un tipo USD→EUR en ppm. Redondeo al céntimo más cercano. */
export function eurCentsOf(usdMicro: number, usdEurPpm: number): number {
	return Math.round((usdMicro * usdEurPpm) / 1e10);
}

/** Agrupa el coste por día, proveedor y app, convertido con el tipo de cada operación. */
export function aiCostsInEur(
	facts: readonly OperationCostFact[],
	rateOf: (fxRateId: string) => number | null
): AiCostsInEur {
	const groups = new Map<
		string,
		{ date: string; provider: string; app: string; usdMicro: number; eurCents: number }
	>();
	let unconverted = 0;
	for (const fact of facts) {
		const ppm = fact.fxRateId === null ? null : rateOf(fact.fxRateId);
		if (ppm === null) unconverted += 1;
		const key = `${fact.date}|${fact.provider}|${fact.appId}`;
		const group = groups.get(key) ?? {
			date: fact.date,
			provider: fact.provider,
			app: fact.appId,
			usdMicro: 0,
			eurCents: 0
		};
		group.usdMicro += fact.usdMicro;
		group.eurCents += ppm === null ? 0 : eurCentsOf(fact.usdMicro, ppm);
		groups.set(key, group);
	}
	const costs = [...groups.values()].sort((left, right) =>
		`${left.date}${left.provider}${left.app}`.localeCompare(
			`${right.date}${right.provider}${right.app}`
		)
	);
	return { costs, unconverted };
}
