// Adaptador del reloj (constitución, principio IV y «Datos y almacenamiento»). Es el único
// lugar donde se lee el tiempo real: el dominio y los servicios reciben el `Clock` por parámetro.
import { toCivilDate, toEpochMs, type CivilDate, type EpochMs } from '$lib/shared/time';

export interface Clock {
	/** Instante actual en milisegundos UTC. */
	now(): EpochMs;
	/** Día civil actual en Europe/Madrid (cortes de topes, estadísticas y caducidades). */
	today(): CivilDate;
}

const MADRID = 'Europe/Madrid';

/** Convierte un instante en el día civil de Madrid, incluidos los días de cambio de hora. */
export function civilDateInMadrid(now: EpochMs): CivilDate {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: MADRID,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(new Date(now));

	const value = (type: Intl.DateTimeFormatPartTypes): string =>
		parts.find((part) => part.type === type)?.value ?? '';

	return toCivilDate(`${value('year')}-${value('month')}-${value('day')}`);
}

/** Reloj real del proceso. */
export function createSystemClock(): Clock {
	return {
		now: () => toEpochMs(Date.now()),
		today: () => civilDateInMadrid(toEpochMs(Date.now()))
	};
}
