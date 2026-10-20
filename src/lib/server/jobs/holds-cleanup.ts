// Tarea `holds-cleanup` (FR-028, BE-FR-71; T332): libera las reservas de saldo caducadas. La regla y sus casos están probados en el
// servicio de créditos (T122); aquí solo se llama al servicio con el reloj de la composición. Devuelve cuántas reservas liberó.
import type { Credits } from '$lib/server/features/credits';

export function runHoldsCleanup(credits: Pick<Credits, 'expireHolds'>): number {
	return credits.expireHolds();
}
