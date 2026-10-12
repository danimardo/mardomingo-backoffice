// Créditos de un paquete (BE-FR-23, BE-FR-25 CA1; T229). Sin I/O. Créditos = precio (céntimos) × créditos por euro ×
// (1 + bonificación), en micro-créditos (×10⁶). Se calcula con enteros exactos (BigInt) y se divide entre 100 al final: los
// céntimos ya están en el factor, así que la división es exacta.

export interface PackInput {
	readonly priceEurCents: number;
	readonly creditsPerEur: number;
	readonly bonusPpm: number;
}

const MICRO = 1_000_000n;
const PPM = 1_000_000n;

export function packCreditsMicro(input: PackInput): number {
	if (!Number.isSafeInteger(input.priceEurCents) || input.priceEurCents <= 0) {
		throw new RangeError('el precio del paquete debe ser un entero positivo en céntimos');
	}
	const price = BigInt(input.priceEurCents);
	const perEur = BigInt(input.creditsPerEur);
	const bonus = BigInt(input.bonusPpm);
	// price (céntimos) × perEur × (1 + bonus) × 10⁶ / 100 = price × perEur × (PPM + bonus) × 10⁶ / (100 × PPM)
	const micro = (price * perEur * (PPM + bonus) * MICRO) / (100n * PPM);
	return Number(micro);
}
