// Tipo de cambio USD→EUR (BE-FR-87; FR-036; R13; T147). Puro: ppm enteros con `BigInt` y fechas civiles `YYYY-MM-DD`.
// El tipo del BCE llega como texto del CSV y se convierte sin pasar por `float`.

import { InvalidAmountError } from '$lib/shared/money';

/** Valor sin filas en la base de datos (BE-FR-87; el valor por defecto de la configuración). */
export const DEFAULT_FX_USD_EUR_PPM = 920_000;

const PPM = BigInt(1_000_000);
const ECB_DECIMALS = 6;

/**
 * Convierte un tipo del BCE escrito como texto (`1.0870`) en ppm exactos (`1.087.000`). Solo acepta punto decimal y hasta
 * seis decimales; cualquier otra cosa es un error (no se redondea en silencio).
 */
export function parseRatePpm(text: string): number {
	const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(text);
	if (match?.[1] === undefined) throw new InvalidAmountError('tipo de cambio no válido');
	const integer = match[1];
	const fraction = (match[2] ?? '').padEnd(ECB_DECIMALS, '0');
	const value = Number(BigInt(integer) * PPM + BigInt(fraction));
	if (value <= 0) throw new InvalidAmountError('tipo de cambio no positivo');
	return value;
}

/**
 * `fx_usd_eur = (1 / tipo_BCE) × (1 + colchón)`, en ppm. El cociente se redondea al ppm más cercano (mitad hacia arriba).
 * El colchón llega en ppm (30.000 = 3 %).
 */
export function fxUsdEurPpm(input: {
	readonly bceRatePpm: number;
	readonly bufferPpm: number;
}): number {
	if (!Number.isSafeInteger(input.bceRatePpm) || input.bceRatePpm <= 0) {
		throw new InvalidAmountError('tipo BCE no positivo');
	}
	// (1 / (bce / 10^6)) × ((10^6 + colchón) / 10^6) = 10^12 × (10^6 + colchón) / (bce × 10^6), redondeado.
	const numerator = BigInt(10) ** BigInt(12) * (PPM + BigInt(input.bufferPpm));
	const denominator = BigInt(input.bceRatePpm) * PPM;
	const rounded = (numerator * BigInt(2) + denominator) / (denominator * BigInt(2));
	return Number(rounded);
}

export interface FxRow {
	readonly usdEurPpm: number;
	readonly source: 'ecb' | 'manual';
	readonly effectiveFrom: number;
}

export interface CurrentFx {
	readonly usdEurPpm: number;
	readonly source: 'ecb' | 'manual' | 'default';
	readonly effectiveFrom: number | null;
}

/**
 * Vigente en `now`: la fila con mayor `effective_from` ya en vigor. Un valor manual vigente sustituye al automático mientras
 * sea la última fila (BE-FR-87 CA3). Sin filas, el valor por defecto.
 */
export function currentRowOf<T extends FxRow>(rows: readonly T[], now: number): T | undefined {
	let current: T | undefined;
	for (const row of rows) {
		if (row.effectiveFrom > now) continue;
		if (current === undefined || row.effectiveFrom >= current.effectiveFrom) current = row;
	}
	return current;
}

export function currentFx(rows: readonly FxRow[], now: number): CurrentFx {
	const current = currentRowOf(rows, now);
	if (current === undefined)
		return { usdEurPpm: DEFAULT_FX_USD_EUR_PPM, source: 'default', effectiveFrom: null };
	return {
		usdEurPpm: current.usdEurPpm,
		source: current.source,
		effectiveFrom: current.effectiveFrom
	};
}

// ---------------------------------------------------------------------------------------------------------------------
// Fechas civiles (`YYYY-MM-DD`) sin `Date` local: días desde 1970-01-01, que fue jueves.

function daysOf(civil: string): number {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(civil)) throw new InvalidAmountError('fecha civil no válida');
	return daysFromCivilUtc(
		Number(civil.slice(0, 4)),
		Number(civil.slice(5, 7)),
		Number(civil.slice(8, 10))
	);
}

/** Días desde 1970-01-01 para una fecha civil (algoritmo de días civiles, sin zona horaria). */
function daysFromCivilUtc(year: number, month: number, day: number): number {
	const y = month <= 2 ? year - 1 : year;
	const era = Math.floor(y / 400);
	const yoe = y - era * 400;
	const mp = (month + 9) % 12;
	const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
	const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
	return era * 146_097 + doe - 719_468;
}

/** Día de la semana: 0 = domingo, 6 = sábado. */
function weekdayOf(days: number): number {
	return (((days + 4) % 7) + 7) % 7;
}

function isWeekday(days: number): boolean {
	const day = weekdayOf(days);
	return day !== 0 && day !== 6;
}

/**
 * Días laborables sin publicar desde la última fecha del BCE hasta hoy (incluido). El fin de semana no cuenta: el BCE no
 * publica entonces, y eso no es un fallo (BE-FR-87 CA2).
 */
export function staleWeekdays(lastDate: string, today: string): number {
	const from = daysOf(lastDate);
	const to = daysOf(today);
	let count = 0;
	for (let day = from + 1; day <= to; day += 1) {
		if (isWeekday(day)) count += 1;
	}
	return count;
}

/**
 * Una observación del BCE es la actual si su fecha es la última publicación esperada: hoy si es laborable, o el último
 * viernes si es fin de semana. Una observación más antigua sí cuenta como fallo (T145).
 */
export function isCurrentEcbObservation(input: {
	readonly timePeriod: string;
	readonly today: string;
}): boolean {
	let expected = daysOf(input.today);
	while (!isWeekday(expected)) expected -= 1;
	return daysOf(input.timePeriod) >= expected;
}
