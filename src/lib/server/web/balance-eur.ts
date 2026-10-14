// Equivalencia en euros del saldo para W18 (BE-FR-22; T258). Puro: recibe los paquetes a la venta ya calculados (`payments`), así no
// lee otra funcionalidad. Un crédito vale lo que cuesta en el paquete activo más barato por crédito. Redondeo al céntimo más
// cercano. Un saldo no positivo vale cero; sin paquetes no hay equivalencia.

export interface SalePackPrice {
	readonly priceCents: number;
	readonly creditsMicro: number;
}

export function balanceEurCentsOf(
	balanceMicro: number,
	packs: readonly SalePackPrice[]
): number | null {
	const cheapest = packs
		.filter((pack) => pack.creditsMicro > 0)
		.reduce<SalePackPrice | null>(
			(best, pack) =>
				best === null || pack.priceCents / pack.creditsMicro < best.priceCents / best.creditsMicro
					? pack
					: best,
			null
		);
	if (cheapest === null) return null;
	if (balanceMicro <= 0) return 0;
	return Math.round((balanceMicro * cheapest.priceCents) / cheapest.creditsMicro);
}
