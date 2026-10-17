// Forma de una fila de consumo para W24 (BE-FR-49.4; T258): fecha, app, operación con su nombre del catálogo y estado. Nunca el
// modelo, el coste real ni el id interno de la operación. Los créditos salen en su valor decimal para la tabla.
import { civilDateOf } from '$lib/shared/dates';
import type { EpochMs } from '$lib/shared/time';

export interface ConsumptionRowDto {
	readonly date: string;
	readonly appName: string;
	readonly operation: string;
	readonly status: string;
	readonly credits: number;
}

export function consumptionRowDto(
	row: {
		readonly createdAt: EpochMs;
		readonly status: string;
		readonly chargedMicro: number;
	},
	names: { readonly appName: string | undefined; readonly operationName: string | undefined }
): ConsumptionRowDto {
	return {
		date: civilDateOf(row.createdAt),
		appName: names.appName ?? '',
		operation: names.operationName ?? '',
		status: row.status,
		credits: row.chargedMicro / 1_000_000
	};
}
