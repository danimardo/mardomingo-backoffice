// Filas CSV de los movimientos del panel (BE-FR-49.6; T252). Fecha del día de Madrid, tipo, créditos (micro ÷ 10⁶, con coma
// decimal al serializar) y app. La serialización es la común de `shared/csv`.
import type { CsvCell } from '$lib/server/shared/csv';
import { civilDateOf } from '$lib/shared/dates';
import type { EpochMs } from '$lib/shared/time';

export interface MovementFact {
	readonly createdAt: EpochMs;
	readonly type: string;
	readonly amountMicro: number;
	readonly appName: string | null;
}

export function movementRowsOf(movements: readonly MovementFact[]): CsvCell[][] {
	return movements.map((movement) => [
		civilDateOf(movement.createdAt),
		movement.type,
		movement.amountMicro / 1_000_000,
		movement.appName ?? ''
	]);
}
