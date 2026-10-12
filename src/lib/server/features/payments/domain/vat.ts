// IVA incluido en el precio (BE-FR-25 CA5, D-17; T229). Solo España, 21 %. Enteros en céntimos: la base se redondea al
// céntimo más próximo y la cuota es la diferencia, así que base + cuota = total siempre. Otros países no se calculan:
// no se inventa un tratamiento fiscal.

export interface VatSplit {
	readonly baseEurCents: number;
	readonly vatEurCents: number;
}

export function splitVat(input: {
	readonly totalEurCents: number;
	readonly country: string;
}): VatSplit {
	if (input.country !== 'ES') {
		throw new RangeError('el desglose del IVA solo se calcula para España (ES)');
	}
	if (!Number.isSafeInteger(input.totalEurCents) || input.totalEurCents <= 0) {
		throw new RangeError('el total debe ser un entero positivo en céntimos');
	}
	// base = total / 1,21 redondeado al céntimo, con enteros: floor((total × 100 + 60) / 121)
	const baseEurCents = Math.floor((input.totalEurCents * 100 + 60) / 121);
	return { baseEurCents, vatEurCents: input.totalEurCents - baseEurCents };
}
