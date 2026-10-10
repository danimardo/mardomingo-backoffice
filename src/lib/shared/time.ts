// Tipos de tiempo con marca (data-model 1.1; constitución, «Datos y almacenamiento»).
// EpochMs: instante en milisegundos UTC. CivilDate: día de calendario YYYY-MM-DD, que se
// interpreta en Europe/Madrid. Sin `Date`: la validación es aritmética para poder usarla en
// el cliente y en el dominio (ESLint prohíbe `new Date()` en `src/lib/shared`).

export type EpochMs = number & { readonly __brand: 'EpochMs' };
export type CivilDate = string & { readonly __brand: 'CivilDate' };

export class InvalidTimeError extends Error {
	readonly type: string;

	constructor(type: string) {
		super(`Tiempo inválido (${type}): formato o valor fuera de rango.`);
		this.name = 'InvalidTimeError';
		this.type = type;
	}
}

export function toEpochMs(value: number): EpochMs {
	if (!Number.isSafeInteger(value) || value < 0) throw new InvalidTimeError('EpochMs');
	return value as EpochMs;
}

export function isLeapYear(year: number): boolean {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
	if (month === 2) return isLeapYear(year) ? 29 : 28;
	return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

const CIVIL_DATE_FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toCivilDate(value: string): CivilDate {
	const match = CIVIL_DATE_FORMAT.exec(value);
	if (!match) throw new InvalidTimeError('CivilDate');

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	if (month < 1 || month > 12) throw new InvalidTimeError('CivilDate');
	if (day < 1 || day > daysInMonth(year, month)) throw new InvalidTimeError('CivilDate');

	return value as CivilDate;
}
