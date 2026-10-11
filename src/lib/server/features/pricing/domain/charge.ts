// Fórmula de cobro (BE-FR-19; BE-FR-22; D-07; T147). Puro: solo enteros y `BigInt`, sin `float` ni fechas. El resultado
// sale en micro-créditos (µc) y el redondeo sube (`ceil`) solo en el último paso.
//
//   cobro_µc = ceil( coste_µUSD × (1 + comisión) × fx × margen × créditos_por_euro_uso / 10^18 )
//
// donde comisión, fx y margen van en ppm (1.000.000 = 1), y `créditos_por_euro_uso` es el parámetro de consumo
// (independiente del de compra, BE-FR-19).
import { InvalidAmountError } from '$lib/shared/money';

const PPM = BigInt(1_000_000);
const DENOMINATOR = BigInt(10) ** BigInt(18);

export interface ChargeInput {
	/** Coste real en micro-USD (µUSD). */
	readonly costMicroUsd: number;
	/** Comisión indirecta del proveedor que respondió (`provider_fee_pct_*`), en ppm. */
	readonly providerFeePpm: number;
	/** Tipo USD→EUR en ppm (`fx_usd_eur`). */
	readonly fxUsdEurPpm: number;
	/** Margen de la operación, o el global si no tiene, en ppm (2.000.000 = ×2,0). */
	readonly marginPpm: number;
	/** `credits_per_eur_usage`: créditos por euro de precio de consumo. */
	readonly creditsPerEurUsage: number;
}

function integerOf(value: number, name: string): bigint {
	if (!Number.isSafeInteger(value)) throw new InvalidAmountError(`${name} no es un entero seguro`);
	return BigInt(value);
}

/** Cobro de una operación completada, en micro-créditos. Falla en lugar de devolver un resultado no seguro. */
export function computeCharge(input: ChargeInput): number {
	const cost = integerOf(input.costMicroUsd, 'coste');
	if (cost < BigInt(0)) throw new InvalidAmountError('el coste no puede ser negativo');
	const numerator =
		cost *
		(PPM + integerOf(input.providerFeePpm, 'comisión')) *
		integerOf(input.fxUsdEurPpm, 'tipo de cambio') *
		integerOf(input.marginPpm, 'margen') *
		integerOf(input.creditsPerEurUsage, 'créditos por euro');
	const charge = (numerator + DENOMINATOR - BigInt(1)) / DENOMINATOR;
	if (!Number.isSafeInteger(Number(charge)))
		throw new InvalidAmountError('el cobro no cabe en un entero seguro');
	return Number(charge);
}

/** Margen aplicable: el de la operación si lo tiene; si no, el global (BE-FR-19). */
export function marginFor(input: {
	readonly operationMarginPpm: number | null;
	readonly globalMarginPpm: number;
}): number {
	return input.operationMarginPpm ?? input.globalMarginPpm;
}
