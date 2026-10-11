// Orden de las comprobaciones de `/ai/chat` (api-v1 1.8, pasos 5–14; FR-063; T160). Puro. El primer fallo determina la
// respuesta; los pasos de `protections` (versión, mantenimiento, freno y frecuencia) son puntos de composición.

export const CHAT_STEP_ORDER = Object.freeze([
	'session',
	'app_version',
	'maintenance',
	'global_freeze',
	'legal',
	'idempotency',
	'validation',
	'rate_limit',
	'max_cost',
	'balance'
] as const);

export type ChatStepName = (typeof CHAT_STEP_ORDER)[number];

/** Pasos que implementa `protections` (Phase 6); `ai` los recibe como puntos de composición. */
export const PROTECTIONS_STEPS: readonly ChatStepName[] = Object.freeze([
	'app_version',
	'maintenance',
	'global_freeze',
	'rate_limit'
]);

export interface PipelineFailure {
	readonly step: ChatStepName;
	readonly code: string;
	readonly details?: Readonly<Record<string, unknown>>;
}

export interface PipelineStep<C> {
	readonly name: ChatStepName;
	readonly check: (context: C) => PipelineFailure | null;
}

/** Ejecuta los pasos en orden y devuelve el primer fallo; los posteriores no se evalúan. */
export function runPipeline<C>(
	steps: readonly PipelineStep<C>[],
	context: C
): PipelineFailure | null {
	for (const step of steps) {
		const failure = step.check(context);
		if (failure !== null) return failure;
	}
	return null;
}
