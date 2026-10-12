// Filas CSV del consumo del panel (BE-FR-49.6; T252). Puro: los hechos de la operación llegan por parámetro; la serialización
// es la común de `shared/csv`.
import type { CsvCell } from '$lib/server/shared/csv';
import { civilDateOf } from '$lib/shared/dates';
import type { EpochMs } from '$lib/shared/time';

export interface ConsumptionFact {
	readonly createdAt: EpochMs;
	readonly appName: string;
	readonly operation: string;
	readonly status: string;
	readonly chargedMicro: number;
}

export function consumptionRowsOf(operations: readonly ConsumptionFact[]): CsvCell[][] {
	return operations.map((operation) => [
		civilDateOf(operation.createdAt),
		operation.appName,
		operation.operation,
		operation.status,
		operation.chargedMicro / 1_000_000
	]);
}
