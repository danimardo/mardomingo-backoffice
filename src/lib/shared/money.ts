// Tipos de importe con marca (principio I; ADR 0003). Todos los importes son enteros escalados:
// micro-créditos (µc), céntimos de euro, micro-USD y partes por millón (ppm). Ningún importe
// se representa como decimal en coma flotante. Esta carpeta la comparten cliente y servidor.

export type Micro = number & { readonly __brand: 'Micro' };
export type EurCents = number & { readonly __brand: 'EurCents' };
export type MicroUsd = number & { readonly __brand: 'MicroUsd' };
export type Ppm = number & { readonly __brand: 'Ppm' };

/** 1 crédito = 1.000.000 micro-créditos (data-model 1.1). */
export const MICRO_PER_CREDIT = 1_000_000;
/** 1 USD = 1.000.000 micro-USD. */
export const MICRO_USD_PER_USD = 1_000_000;
/** 1 = 1.000.000 ppm (margen 2,0 → 2.000.000). */
export const PPM_PER_UNIT = 1_000_000;

export class InvalidAmountError extends Error {
	readonly type: string;

	constructor(type: string) {
		super(`Importe inválido (${type}): debe ser un entero seguro.`);
		this.name = 'InvalidAmountError';
		this.type = type;
	}
}

function safeInteger(value: number, type: string, allowNegative: boolean): number {
	if (!Number.isSafeInteger(value)) throw new InvalidAmountError(type);
	if (!allowNegative && value < 0) throw new InvalidAmountError(type);
	return value;
}

/** Microcréditos. Pueden ser negativos: un saldo con deuda es negativo (BE-FR-17). */
export function toMicro(value: number): Micro {
	return safeInteger(value, 'Micro', true) as Micro;
}

export function toEurCents(value: number): EurCents {
	return safeInteger(value, 'EurCents', false) as EurCents;
}

export function toMicroUsd(value: number): MicroUsd {
	return safeInteger(value, 'MicroUsd', false) as MicroUsd;
}

export function toPpm(value: number): Ppm {
	return safeInteger(value, 'Ppm', false) as Ppm;
}
