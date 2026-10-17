// Plan de intentos con reintentos y respaldos (BE-FR-77 CA4, BE-FR-80, FR-050, FR-057; T161). Puro: sin I/O ni otras
// funcionalidades. El principal tiene `1 + retries` intentos con esperas crecientes; cada respaldo, un único intento. El
// servicio recorta el plan al `timeout_ms` de la operación (`fitWithin`, de `apps`).

export interface AttemptPlanInput {
	readonly primary: string;
	readonly fallbacks: readonly string[];
	readonly retries: number;
	/** Esperas antes de cada reintento del principal; si faltan, se repite la última. */
	readonly waitsMs: readonly number[];
	readonly attemptTimeoutMs: number;
	readonly fallbackTimeoutMs: number;
}

export interface PlannedAttempt {
	readonly model: string;
	readonly isFallback: boolean;
	readonly timeoutMs: number;
	readonly waitBeforeMs: number;
}

function waitBefore(waitsMs: readonly number[], retry: number): number {
	if (retry === 0) return 0;
	return waitsMs[Math.min(retry - 1, waitsMs.length - 1)] ?? 0;
}

/** Intentos en orden: el principal con sus reintentos y después cada respaldo. */
export function planAttempts(input: AttemptPlanInput): PlannedAttempt[] {
	const planned: PlannedAttempt[] = [];
	for (let retry = 0; retry <= input.retries; retry += 1) {
		planned.push({
			model: input.primary,
			isFallback: false,
			timeoutMs: input.attemptTimeoutMs,
			waitBeforeMs: waitBefore(input.waitsMs, retry)
		});
	}
	for (const model of input.fallbacks) {
		planned.push({
			model,
			isFallback: true,
			timeoutMs: input.fallbackTimeoutMs,
			waitBeforeMs: 0
		});
	}
	return planned;
}
