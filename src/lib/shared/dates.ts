// Fechas de negocio en Europe/Madrid (constitución, «Datos y almacenamiento»; principio VI). Convierte instantes
// (`EpochMs`) en días civiles (`CivilDate`) y viceversa, incluidos los días de cambio de hora. Sin `Date`: la
// aritmética es de días civiles y `Intl` recibe el instante como número.
import { toCivilDate, toEpochMs, type CivilDate, type EpochMs } from './time';

const MADRID = 'Europe/Madrid';
export const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const SECOND_MS = 1_000;

const formatter = new Intl.DateTimeFormat('en-US', {
	timeZone: MADRID,
	hourCycle: 'h23',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit'
});

interface WallClock {
	readonly year: number;
	readonly month: number;
	readonly day: number;
	readonly hour: number;
	readonly minute: number;
	readonly second: number;
}

function wallClockOf(instant: EpochMs): WallClock {
	const wall: Record<string, number> = {};
	for (const part of formatter.formatToParts(instant)) {
		wall[part.type] = Number(part.value);
	}
	return {
		year: wall.year,
		month: wall.month,
		day: wall.day,
		hour: wall.hour,
		minute: wall.minute,
		second: wall.second
	};
}

/** Días desde 1970-01-01 para un día del calendario gregoriano proléptico (algoritmo de días civiles). */
export function daysFromCivil(year: number, month: number, day: number): number {
	const y = month <= 2 ? year - 1 : year;
	const era = Math.floor(y / 400);
	const yearOfEra = y - era * 400;
	const monthIndex = (month + 9) % 12;
	const dayOfYear = Math.floor((153 * monthIndex + 2) / 5) + day - 1;
	const dayOfEra =
		yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
	return era * 146_097 + dayOfEra - 719_468;
}

/** Inversa de `daysFromCivil`: año, mes y día a partir de los días desde 1970-01-01. */
export function civilFromDays(days: number): { year: number; month: number; day: number } {
	const shifted = days + 719_468;
	const era = Math.floor(shifted / 146_097);
	const dayOfEra = shifted - era * 146_097;
	const yearOfEra = Math.floor(
		(dayOfEra -
			Math.floor(dayOfEra / 1_460) +
			Math.floor(dayOfEra / 36_524) -
			Math.floor(dayOfEra / 146_096)) /
			365
	);
	const dayOfYear =
		dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
	const monthIndex = Math.floor((5 * dayOfYear + 2) / 153);
	const day = dayOfYear - Math.floor((153 * monthIndex + 2) / 5) + 1;
	const month = monthIndex < 10 ? monthIndex + 3 : monthIndex - 9;
	const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);
	return { year, month, day };
}

/** Desfase de Madrid respecto a UTC en un instante (ms). Positivo al este de Greenwich. */
function madridOffsetAt(instant: EpochMs): number {
	const wall = wallClockOf(instant);
	const wallMs =
		daysFromCivil(wall.year, wall.month, wall.day) * DAY_MS +
		wall.hour * HOUR_MS +
		wall.minute * MINUTE_MS +
		wall.second * SECOND_MS;
	return wallMs - instant;
}

/** Día civil de Madrid en el que cae un instante, incluidos los días de 23 y 25 horas. */
export function civilDateOf(instant: EpochMs): CivilDate {
	const wall = wallClockOf(instant);
	const pad = (value: number, width: number): string => String(value).padStart(width, '0');
	return toCivilDate(`${pad(wall.year, 4)}-${pad(wall.month, 2)}-${pad(wall.day, 2)}`);
}

// Un CivilDate ya está validado (`toCivilDate`): sus campos están en posiciones fijas YYYY-MM-DD.
const yearOf = (day: CivilDate): number => Number(day.slice(0, 4));
const monthOf = (day: CivilDate): number => Number(day.slice(5, 7));
const dayOf = (day: CivilDate): number => Number(day.slice(8, 10));

/** Instante (ms UTC) de las 00:00 de Madrid de un día civil. */
export function madridMidnight(day: CivilDate): EpochMs {
	const utcMidnight = daysFromCivil(yearOf(day), monthOf(day), dayOf(day)) * DAY_MS;
	const first = utcMidnight - madridOffsetAt(toEpochMs(utcMidnight));
	return toEpochMs(utcMidnight - madridOffsetAt(toEpochMs(first)));
}

/** Día civil que sigue a otro, con la aritmética de días civiles (no depende de la zona). */
export function addDays(day: CivilDate, count: number): CivilDate {
	const days = daysFromCivil(yearOf(day), monthOf(day), dayOf(day)) + count;
	const next = civilFromDays(days);
	const pad = (value: number, width: number): string => String(value).padStart(width, '0');
	return toCivilDate(`${pad(next.year, 4)}-${pad(next.month, 2)}-${pad(next.day, 2)}`);
}

/** Inicio del día de Madrid que contiene el instante: el corte diario de topes y estadísticas. */
export function startOfMadridDay(instant: EpochMs): EpochMs {
	return madridMidnight(civilDateOf(instant));
}
