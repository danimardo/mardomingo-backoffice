// Aviso de saldo bajo (BE-FR-49.7; T253). Puro: decide si hay que avisar o rearmar, sin enviar nada. Un cruce hacia abajo
// avisa una sola vez; al superar el umbral el aviso se rearma. Un umbral nulo desactiva el aviso.

export type LowBalanceEvent = 'notified' | 'rearmed' | null;

export function lowBalanceVerdict(input: {
	readonly balanceMicro: number;
	readonly thresholdMicro: number | null;
	readonly notified: boolean;
}): { readonly event: LowBalanceEvent; readonly notified: boolean } {
	if (input.thresholdMicro === null) return { event: null, notified: input.notified };
	const below = input.balanceMicro < input.thresholdMicro;
	if (below && !input.notified) return { event: 'notified', notified: true };
	if (!below && input.notified) return { event: 'rearmed', notified: false };
	return { event: null, notified: input.notified };
}
