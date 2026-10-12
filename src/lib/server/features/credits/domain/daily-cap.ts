// Tope diario de cuentas sin compra real (FR-022, BE-FR-11.6; T200). Puro: sin I/O ni otras funcionalidades. El día civil
// de Madrid y las cifras del día llegan por parámetro; la transacción de reserva las calcula (T201).

export type DailyCapVerdict =
	{ readonly ok: true } | { readonly ok: false; readonly reason: 'daily_free_limit' };

/**
 * Cobros del día, reservas activas y la nueva reserva no pueden superar el tope diario. Las cuentas con compra real
 * quedan exentas (BE-FR-11 CA2). El tope incluye la nueva reserva: llegar exactamente a él pasa.
 */
export function dailyCapVerdict(input: {
	readonly costsTodayMicro: number;
	readonly activeHoldsMicro: number;
	readonly newHoldMicro: number;
	readonly capMicro: number;
	readonly hasRealPurchase: boolean;
}): DailyCapVerdict {
	if (input.hasRealPurchase) return { ok: true };
	const total = input.costsTodayMicro + input.activeHoldsMicro + input.newHoldMicro;
	return total <= input.capMicro ? { ok: true } : { ok: false, reason: 'daily_free_limit' };
}
