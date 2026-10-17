// Tiempo total de una operación con reintentos y respaldos (BE-FR-77 CA4; T161). Puro: milisegundos enteros.
// Lo usan `ai` para no pasar de `timeout_ms` y `/app/status` para informar de la duración máxima.

export interface TimedAttempt {
	/** Tiempo máximo de la llamada a proveedor de este intento. */
	readonly timeoutMs: number;
	/** Espera antes de este intento (reintentos y respaldos). */
	readonly waitBeforeMs: number;
}

function assertDuration(value: number): void {
	if (!Number.isInteger(value) || value < 0) throw new RangeError('duración no válida');
}

/** Suma de los tiempos máximos y de las esperas de una secuencia de intentos. */
export function totalTimeoutMs(attempts: readonly TimedAttempt[]): number {
	let total = 0;
	for (const attempt of attempts) {
		assertDuration(attempt.timeoutMs);
		assertDuration(attempt.waitBeforeMs);
		total += attempt.timeoutMs + attempt.waitBeforeMs;
	}
	return total;
}

/**
 * Recorta una secuencia de intentos para que su tiempo total no supere `budgetMs`: el intento que no cabe entero se
 * acorta y los siguientes se descartan. Conserva el resto de campos de cada intento (p. ej. el modelo). Así una
 * operación nunca supera su `timeout_ms`.
 */
export function fitWithin<T extends TimedAttempt>(attempts: readonly T[], budgetMs: number): T[] {
	const fitted: T[] = [];
	let spent = 0;
	for (const attempt of attempts) {
		const remaining = budgetMs - spent - attempt.waitBeforeMs;
		if (remaining <= 0) break;
		const timeoutMs = Math.min(attempt.timeoutMs, remaining);
		fitted.push({ ...attempt, timeoutMs });
		spent += attempt.waitBeforeMs + timeoutMs;
	}
	return fitted;
}
