// Reloj de las pruebas de integración que avanza a mano (T209): los plazos (caducidades, reservas, límites por minuto) son
// reproducibles. Lo usan `credits`, `protections` y los tests de cuentas.
import { civilDateOf } from '$lib/shared/dates';
import { toEpochMs, type CivilDate, type EpochMs } from '$lib/shared/time';

export interface MutableClock {
	now(): EpochMs;
	today(): CivilDate;
	set(instant: number): void;
	advance(milliseconds: number): void;
}

/** Reloj que solo avanza cuando la prueba lo pide: los plazos (caducidades, reservas) son reproducibles. */
export function mutableClock(start: number): MutableClock {
	let current = start;
	return {
		now: () => toEpochMs(current),
		today: () => civilDateOf(toEpochMs(current)),
		set(instant) {
			current = instant;
		},
		advance(milliseconds) {
			current += milliseconds;
		}
	};
}
