// Métricas de estadísticas (BE-FR-54; T317–T319). Reglas puras: sin base de datos, sin reloj y sin I/O. La regla de «sin datos» es la
// de siempre: un dato que no existe es nulo, nunca cero. Así una gráfica no confunde «no hubo datos» con «hubo cero».

/** Margen bruto en céntimos: ingresos menos coste. Nulo si falta cualquiera de los dos (no hay margen que calcular). */
export function grossMargin(
	revenueEurCents: number | null,
	costEurCents: number | null
): number | null {
	if (revenueEurCents === null || costEurCents === null) return null;
	return revenueEurCents - costEurCents;
}

/** Céntimos de euro de un importe en micro-USD con un tipo USD→EUR en ppm (micro-USD × ppm / 10¹⁰). Redondeo al céntimo. */
export function usdMicroToEurCents(usdMicro: number, usdEurPpm: number): number {
	return Math.round((usdMicro * usdEurPpm) / 1e10);
}

/** Suma de `valueOf` agrupada por `keyOf`. Solo aparecen los grupos con filas: un grupo vacío no se inventa con cero. */
export function groupSum<T>(
	rows: readonly T[],
	keyOf: (row: T) => string,
	valueOf: (row: T) => number
): Map<string, number> {
	const sums = new Map<string, number>();
	for (const row of rows) {
		const key = keyOf(row);
		sums.set(key, (sums.get(key) ?? 0) + valueOf(row));
	}
	return sums;
}

export interface FunnelInput {
	readonly stage: string;
	readonly count: number | null;
}

export interface FunnelStage {
	readonly stage: string;
	readonly count: number | null;
	/** Tasa respecto a la etapa anterior (la primera, respecto a sí misma). Nula si falta el dato de esta o de la anterior. */
	readonly rate: number | null;
}

/** Embudo por etapas en orden. La tasa de cada etapa es su número entre el de la etapa anterior. */
export function funnel(stages: readonly FunnelInput[]): FunnelStage[] {
	return stages.map((stage, index) => {
		const previous = index === 0 ? stage.count : (stages[index - 1]?.count ?? null);
		const rate =
			stage.count === null || previous === null || previous === 0 ? null : stage.count / previous;
		return {
			stage: stage.stage,
			count: stage.count,
			rate: index === 0 && stage.count !== null && stage.count > 0 ? 1 : rate
		};
	});
}
