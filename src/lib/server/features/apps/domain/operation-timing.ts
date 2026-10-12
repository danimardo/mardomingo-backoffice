// Tiempo máximo total de una operación (BE-FR-77 CA4, FR-050; T193). Puro. El principal tiene un intento más por cada
// espera; cada respaldo, un único intento. El total es la suma de intentos y esperas (`totalTimeoutMs`).
import { totalTimeoutMs, type TimedAttempt } from './total-timeout';

/** Esperas de reintento del chat y de la imagen: un reintento tras 2 s (la política de `ai`). */
export const CHAT_RETRY_WAITS_MS: readonly number[] = Object.freeze([2_000]);

/**
 * Suma de los intentos del principal (uno más que las esperas de reintento) y de cada respaldo. Lo que informa
 * `/app/status` como `operations.<key>.timeoutMs`.
 */
export function operationTotalMs(input: {
	readonly primaryTimeoutMs: number;
	readonly retryWaitsMs: readonly number[];
	readonly fallbackTimeoutsMs: readonly number[];
}): number {
	const attempts: TimedAttempt[] = [
		{ timeoutMs: input.primaryTimeoutMs, waitBeforeMs: 0 },
		...input.retryWaitsMs.map((wait) => ({
			timeoutMs: input.primaryTimeoutMs,
			waitBeforeMs: wait
		})),
		...input.fallbackTimeoutsMs.map((timeoutMs) => ({ timeoutMs, waitBeforeMs: 0 }))
	];
	return totalTimeoutMs(attempts);
}
