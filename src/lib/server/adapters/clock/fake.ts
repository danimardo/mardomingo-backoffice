// Reloj falso para los tests (Historias.md 15.22): fijo y avanzable a mano.
import { toEpochMs, type EpochMs } from '$lib/shared/time';
import { civilDateInMadrid, type Clock } from './clock';

export interface FakeClock extends Clock {
	/** Adelanta el reloj `ms` milisegundos. */
	advance(ms: number): void;
	/** Fija el reloj en un instante concreto. */
	set(value: EpochMs): void;
}

export function createFakeClock(start: EpochMs): FakeClock {
	let current = start;
	return {
		now: () => current,
		today: () => civilDateInMadrid(current),
		advance: (ms) => {
			current = toEpochMs(current + ms);
		},
		set: (value) => {
			current = value;
		}
	};
}
