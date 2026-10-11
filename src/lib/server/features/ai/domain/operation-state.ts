// Estados de una operación de IA y sus transiciones (data-model 4.4; FR-033, BE-FR-21; T160). Puro.
// `in_progress` es el único estado no final: una operación siempre termina en uno de los demás, y ninguno vuelve atrás.

export const OPERATION_STATUSES = Object.freeze([
	'in_progress',
	'ok',
	'provider_error',
	'cancelled',
	'undelivered',
	'interrupted',
	'rejected'
] as const);

export type OperationStatus = (typeof OPERATION_STATUSES)[number];

const FINAL_FROM_IN_PROGRESS: readonly OperationStatus[] = Object.freeze([
	'ok',
	'provider_error',
	'cancelled',
	'undelivered',
	'interrupted',
	'rejected'
]);

/** Solo las operaciones que llegaron a cobrarse: entregadas o no entregadas tras la respuesta del proveedor. */
const CHARGED: readonly OperationStatus[] = Object.freeze(['ok', 'undelivered']);

/** Si el estado final cobra el coste real (BE-FR-21, FR-033). Un fallo o una cancelación antes de la respuesta no cobran. */
export function chargesFor(status: OperationStatus): boolean {
	return CHARGED.includes(status);
}

/** Una operación solo sale de `in_progress`, y solo hacia un estado final (data-model 4.4). */
export function canTransition(from: OperationStatus, to: OperationStatus): boolean {
	return from === 'in_progress' && FINAL_FROM_IN_PROGRESS.includes(to);
}
