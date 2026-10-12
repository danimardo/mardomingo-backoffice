// Límites de frecuencia y concurrencia (FR-069, BE-FR-43, BE-FR-63 CA4; T200). Puro: las marcas de tiempo y los
// contadores llegan por parámetro; nada se guarda aquí. La ventana es deslizante y de un minuto.

export type RateVerdict =
	{ readonly ok: true } | { readonly ok: false; readonly retryAfterSeconds: number };

/** Ventana deslizante: bloquea si hay `limit` peticiones en la ventana. `Retry-After` es lo que falta para que salga la más antigua. */
export function rateLimitVerdict(input: {
	readonly now: number;
	readonly windowMs: number;
	readonly limit: number;
	readonly timestamps: readonly number[];
}): RateVerdict {
	const inWindow = input.timestamps.filter((at) => input.now - at < input.windowMs);
	if (inWindow.length < input.limit) return { ok: true };
	const oldest = Math.min(...inWindow);
	const remainingMs = oldest + input.windowMs - input.now;
	return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)) };
}

export type TwoLevelVerdict =
	| { readonly ok: true }
	| {
			readonly ok: false;
			readonly reason: 'rate_limited_account' | 'rate_limited_app';
			readonly retryAfterSeconds: number;
	  };

/**
 * Límite de la cuenta (suma de todas sus apps) y límite de la app (≤ el de la cuenta, solo sus peticiones). Gana el
 * primero alcanzado: se comprueba la cuenta antes que la app.
 */
export function twoLevelRateVerdict(input: {
	readonly now: number;
	readonly windowMs: number;
	readonly account: { readonly limit: number; readonly timestamps: readonly number[] };
	readonly app: { readonly limit: number; readonly timestamps: readonly number[] } | null;
}): TwoLevelVerdict {
	const account = rateLimitVerdict({ now: input.now, windowMs: input.windowMs, ...input.account });
	if (!account.ok) {
		return {
			ok: false,
			reason: 'rate_limited_account',
			retryAfterSeconds: account.retryAfterSeconds
		};
	}
	if (input.app === null) return { ok: true };
	const app = rateLimitVerdict({ now: input.now, windowMs: input.windowMs, ...input.app });
	if (!app.ok)
		return { ok: false, reason: 'rate_limited_app', retryAfterSeconds: app.retryAfterSeconds };
	return { ok: true };
}

export type ConcurrencyVerdict =
	| { readonly ok: true }
	| { readonly ok: false; readonly reason: 'concurrency_account' | 'concurrency_app' };

/** Transcripciones en curso: el límite de la cuenta y el de la app, comprobados en ese orden. */
export function concurrencyVerdict(input: {
	readonly accountInFlight: number;
	readonly appInFlight: number;
	readonly accountLimit: number;
	readonly appLimit: number;
}): ConcurrencyVerdict {
	if (input.accountInFlight >= input.accountLimit)
		return { ok: false, reason: 'concurrency_account' };
	if (input.appInFlight >= input.appLimit) return { ok: false, reason: 'concurrency_app' };
	return { ok: true };
}
