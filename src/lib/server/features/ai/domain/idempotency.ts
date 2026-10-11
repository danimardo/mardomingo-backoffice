// Máquina de idempotencia de las operaciones (BE-FR-81 CA1–CA2, D-12, FR-058; T159). Puro: decide según la última
// operación con la misma clave dentro de la ventana. No mira el cuerpo de la petición.
import type { OperationStatus } from './operation-state';

export interface LastOperation {
	readonly status: OperationStatus;
	readonly createdAt: number;
	readonly operationId: string;
}

export type IdempotencyDecision =
	| { readonly action: 'run'; readonly replayOfUndelivered: boolean }
	| { readonly action: 'in_progress' }
	| { readonly action: 'duplicate'; readonly operationId: string };

/**
 * Sin clave, o sin operación previa con esa clave dentro de la ventana, la petición se ejecuta. Con una operación en
 * curso, `REQUEST_IN_PROGRESS`. Ya entregada (`ok`), `DUPLICATE_REQUEST` sin volver a ejecutarla. Tras `undelivered`,
 * se ejecuta de nuevo sin cobro (`undelivered_replay`). Tras cualquier otro estado, se ejecuta con normalidad.
 */
export function decideIdempotency(input: {
	readonly key: string | null;
	readonly last: LastOperation | undefined;
	readonly now: number;
	readonly windowMs: number;
}): IdempotencyDecision {
	const { key, last, now, windowMs } = input;
	if (key === null || last === undefined || now - last.createdAt > windowMs) {
		return { action: 'run', replayOfUndelivered: false };
	}
	switch (last.status) {
		case 'in_progress':
			return { action: 'in_progress' };
		case 'ok':
			return { action: 'duplicate', operationId: last.operationId };
		case 'undelivered':
			return { action: 'run', replayOfUndelivered: true };
		default:
			return { action: 'run', replayOfUndelivered: false };
	}
}
