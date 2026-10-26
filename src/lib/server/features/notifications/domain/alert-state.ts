// Estado de las alertas al administrador (Historias 5.13; SC-019; T151). Puro: decide qué hacer con una alerta según su
// estado anterior, y el servicio de `notifications` lo persiste en `alerts_state` y envía el email. Cada lote que dispara
// una alerta añade su clave aquí; las claves son un tipo cerrado, así que no hay claves inventadas.

/** Claves de alerta: `fx_stale` (L06), `model:<id>:retired` y `model:<id>:price` (L07), `flagged:<usuario>:<día>` (L07), `global_brake:<día>` (L09), `ledger_mismatch:<usuario>`, `openrouter_balance` y `mistral_billing` (L14). */
export type AlertKey =
	| 'fx_stale'
	| `model:${string}:retired`
	| `model:${string}:price`
	| `flagged:${string}:${string}`
	| `global_brake:${string}`
	| `ledger_mismatch:${string}`
	| 'openrouter_balance'
	| 'mistral_billing';

export const alertKeys = Object.freeze({
	fxStale: (): AlertKey => 'fx_stale',
	modelRetired: (modelId: string): AlertKey => `model:${modelId}:retired`,
	modelPrice: (modelId: string): AlertKey => `model:${modelId}:price`,
	flagged: (userId: string, day: string): AlertKey => `flagged:${userId}:${day}`,
	globalBrake: (day: string): AlertKey => `global_brake:${day}`,
	ledgerMismatch: (userId: string): AlertKey => `ledger_mismatch:${userId}`,
	openrouterBalance: (): AlertKey => 'openrouter_balance',
	mistralBilling: (): AlertKey => 'mistral_billing'
});

/** Fila de `alerts_state`: si la alerta está activa y cuándo se envió por última vez. */
export interface AlertRecord {
	readonly active: boolean;
	readonly lastSentAt: number | null;
}

export type RaiseDecision =
	| { readonly action: 'send'; readonly next: AlertRecord }
	| { readonly action: 'suppress'; readonly next: AlertRecord };

/** La condición de la alerta se cumple: se envía solo si no estaba activa; si ya lo estaba, se suprime. */
export function decideRaise(current: AlertRecord | undefined, now: number): RaiseDecision {
	if (current !== undefined && current.active) return { action: 'suppress', next: current };
	return { action: 'send', next: { active: true, lastSentAt: now } };
}

export type ClearDecision =
	| { readonly action: 'rearm'; readonly next: AlertRecord }
	| { readonly action: 'none'; readonly next: AlertRecord | undefined };

/** La condición se normaliza: si la alerta estaba activa, se rearma (sin email); si no, no hay nada que hacer. */
export function decideClear(current: AlertRecord | undefined): ClearDecision {
	if (current !== undefined && current.active) {
		return { action: 'rearm', next: { active: false, lastSentAt: current.lastSentAt } };
	}
	return { action: 'none', next: current };
}
