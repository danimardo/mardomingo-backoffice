// Estimación del coste máximo (BE-FR-72; T147). Es lo que se reserva antes de llamar al proveedor (BE-FR-71). Puro: enteros
// en micro-USD, redondeo hacia arriba en cada estimación. Se toma el precio más caro entre el principal y los respaldos.
import { InvalidAmountError } from '$lib/shared/money';

/** Precios de un modelo por millón de tokens, en µUSD (250.000 = 0,25 USD). */
export interface ModelPrice {
	readonly inputPerMTokMicroUsd: number;
	readonly outputPerMTokMicroUsd: number;
}

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
	return (numerator + denominator - BigInt(1)) / denominator;
}

const MILLION = BigInt(1_000_000);

/**
 * Chat: tokens de entrada estimados (caracteres / caracteres por token + tokens por imagen) × precio de entrada, más la
 * salida máxima × precio de salida. Se calcula con cada modelo y se toma el más caro.
 */
export function estimateChatMicroUsd(input: {
	readonly charCount: number;
	readonly imageCount: number;
	readonly charsPerToken: number;
	readonly imageTokens: number;
	readonly maxOutputTokens: number;
	readonly models: readonly ModelPrice[];
}): number {
	if (input.models.length === 0) throw new InvalidAmountError('sin modelos para estimar');
	const inputTokens =
		ceilDiv(BigInt(input.charCount), BigInt(input.charsPerToken)) +
		BigInt(input.imageCount) * BigInt(input.imageTokens);
	const outputTokens = BigInt(input.maxOutputTokens);
	const costs = input.models.map((model) =>
		ceilDiv(
			inputTokens * BigInt(model.inputPerMTokMicroUsd) +
				outputTokens * BigInt(model.outputPerMTokMicroUsd),
			MILLION
		)
	);
	return Number(costs.reduce((max, cost) => (cost > max ? cost : max)));
}

/** Transcripción: duración medida en el servidor × el precio por minuto más caro (Voxtral o su respaldo). */
export function estimateTranscriptionMicroUsd(input: {
	readonly seconds: number;
	readonly perMinuteMicroUsd: readonly number[];
}): number {
	if (input.perMinuteMicroUsd.length === 0) throw new InvalidAmountError('sin precio por minuto');
	const worst = input.perMinuteMicroUsd.reduce((max, price) => (price > max ? price : max));
	return Number(ceilDiv(BigInt(input.seconds) * BigInt(worst), BigInt(60)));
}

/** Imagen: el precio por imagen del modelo o, si no se conoce, el coste máximo estimado de la operación; `null` si no hay ninguno. */
export function estimateImageMicroUsd(input: {
	readonly perImageMicroUsd: number | null;
	readonly estimatedMaxMicroUsd: number | null;
}): number | null {
	return input.perImageMicroUsd ?? input.estimatedMaxMicroUsd;
}

/** Sin precio conocido ni coste máximo estimado, la operación no se puede activar (BE-FR-72 CA3). */
export function canActivateOperation(input: {
	readonly hasModelPrice: boolean;
	readonly hasEstimatedMaxCost: boolean;
}): boolean {
	return input.hasModelPrice || input.hasEstimatedMaxCost;
}

/** Comprueba la estimación frente al tope de la operación (BE-FR-72 CA1: `OPERATION_TOO_EXPENSIVE`). */
export function checkMaxCost(input: {
	readonly estimatedMicro: number;
	readonly maxMicro: number;
}):
	| { readonly ok: true }
	| { readonly ok: false; readonly estimatedMicro: number; readonly maxMicro: number } {
	if (input.estimatedMicro <= input.maxMicro) return { ok: true };
	return { ok: false, estimatedMicro: input.estimatedMicro, maxMicro: input.maxMicro };
}
