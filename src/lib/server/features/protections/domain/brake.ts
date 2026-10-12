// Freno global por coste de cuentas sin compra real (FR-072, BE-FR-46 CA1; T199, T200). Puro: el coste del día y el
// estado guardado llegan por parámetro. El freno se activa una vez por día civil de Madrid y se rearma solo al día
// siguiente; una liberación manual no vuelve a activarlo ese mismo día.
import type { CivilDate } from '$lib/shared/time';

/** Estado persistido del freno (data-model 3.9). `day` es el día civil de Madrid al que pertenece el estado. */
export interface BrakeState {
	readonly day: CivilDate;
	readonly active: boolean;
	readonly activatedAt: number | null;
	readonly releasedAt: number | null;
	readonly releasedBy: string | null;
}

/**
 * Céntimos de euro de un coste en micro-USD, con el tipo USD→EUR en ppm (920.000 = 0,92). Redondeo hacia arriba: un freno
 * de protección no debe quedarse corto.
 */
export function eurCentsOf(input: {
	readonly costMicroUsd: number;
	readonly fxUsdEurPpm: number;
}): number {
	return Math.ceil((input.costMicroUsd * input.fxUsdEurPpm) / 1e10);
}

export type BrakeVerdict = { readonly active: boolean; readonly trip: boolean };

/**
 * Activo hoy si el estado guardado es de hoy y está activo. Se activa (`trip`) solo si no lo está ya y el coste de las
 * cuentas sin compra real supera el límite; tras una liberación manual del día, no vuelve a saltar ese día.
 */
export function brakeVerdict(input: {
	readonly freeCostCents: number;
	readonly limitCents: number;
	readonly stored: BrakeState | null;
	readonly today: CivilDate;
}): BrakeVerdict {
	const stored = input.stored;
	// Un estado guardado de hoy solo puede estar inactivo porque se liberó a mano (la liberación es la única escritura
	// que lo desactiva): ese día ya no vuelve a saltar.
	if (stored !== null && stored.day === input.today) {
		return { active: stored.active, trip: false };
	}
	if (input.freeCostCents > input.limitCents) return { active: true, trip: true };
	return { active: false, trip: false };
}
