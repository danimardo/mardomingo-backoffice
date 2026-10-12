// Ventanas de peticiones por minuto en memoria (BE-FR-43; T200). Son de una sola instancia: se pierden al reiniciar, lo
// que está aceptado en la v4. Cada lectura descarta las marcas fuera de la ventana y las cuentas sin marcas.

export const RATE_WINDOW_MS = 60_000;

export interface RateWindows {
	/** Marcas de la cuenta dentro de la ventana, sumando todas sus apps. */
	accountTimes(userId: string, now: number): number[];
	/** Marcas de la cuenta dentro de la ventana, solo en una app. */
	appTimes(userId: string, appId: string, now: number): number[];
	/** Anota una petición aceptada en la cuenta y en la app. */
	record(userId: string, appId: string, now: number): void;
}

export function createRateWindows(): RateWindows {
	const account = new Map<string, number[]>();
	const perApp = new Map<string, number[]>();

	function fresh(store: Map<string, number[]>, key: string, now: number): number[] {
		const kept = (store.get(key) ?? []).filter((at) => now - at < RATE_WINDOW_MS);
		if (kept.length === 0) store.delete(key);
		else store.set(key, kept);
		return kept;
	}

	return {
		accountTimes: (userId, now) => fresh(account, userId, now),
		appTimes: (userId, appId, now) => fresh(perApp, `${userId}\u0000${appId}`, now),
		record(userId, appId, now) {
			const appKey = `${userId}\u0000${appId}`;
			account.set(userId, [...fresh(account, userId, now), now]);
			perApp.set(appKey, [...fresh(perApp, appKey, now), now]);
		}
	};
}
