// Reglas de los ajustes manuales del administrador (propuesta R04, R05, R06 y R07; decisiones D04, D05, D12 y D13). Funciones
// puras: sin base de datos ni reloj. El reloj llega como `nowMs` y las fechas de negocio son de Europe/Madrid.
import { addDays, civilDateOf, madridMidnight } from '$lib/shared/dates';
import { toCivilDate, toEpochMs, type CivilDate, type EpochMs } from '$lib/shared/time';

/** Tope de créditos enteros por ajuste (D04). Por encima, el ajuste se rechaza con error de validación. */
export const MAX_ADJUSTMENT_CREDITS = 100_000;

/** Horizonte de la caducidad de una bolsa gratuita de ajuste: días desde hoy, en Madrid (D13). */
export const MAX_ADJUSTMENT_EXPIRY_DAYS = 365;

/** `true` si el importe en créditos enteros cabe en un ajuste: entero, positivo y no mayor que el tope. */
export function adjustmentCreditsFit(credits: number): boolean {
	return Number.isInteger(credits) && credits > 0 && credits <= MAX_ADJUSTMENT_CREDITS;
}

/** Céntimos de euro que equivalen a unos créditos, al precio de compra (`credits_per_eur_purchase`), redondeados. */
export function eurCentsOfCredits(credits: number, creditsPerEur: number): number {
	return Math.round((credits * 100) / creditsPerEur);
}

export type FreeExpiryVerdict =
	| { readonly ok: true; readonly expiresAt: EpochMs }
	| { readonly ok: false; readonly reason: 'invalid' | 'past' | 'beyond_horizon' };

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function civilDayOf(text: string): CivilDate | null {
	if (!DAY_PATTERN.test(text)) return null;
	try {
		return toCivilDate(text);
	} catch {
		return null;
	}
}

/**
 * Caducidad de una bolsa gratuita de ajuste a partir del día elegido (R05, D13). El día vale hasta el final de ese día en
 * Madrid: la bolsa caduca a las 00:00 de Madrid del día siguiente, igual que el corte diario. Hoy es válido; un día anterior a
 * hoy ya está caducado; y no se admite más allá de hoy + `MAX_ADJUSTMENT_EXPIRY_DAYS`.
 */
export function freeExpiryOf(text: string, nowMs: number): FreeExpiryVerdict {
	const day = civilDayOf(text);
	if (day === null) return { ok: false, reason: 'invalid' };
	const today = civilDateOf(toEpochMs(nowMs));
	if (day < today) return { ok: false, reason: 'past' };
	if (day > addDays(today, MAX_ADJUSTMENT_EXPIRY_DAYS))
		return { ok: false, reason: 'beyond_horizon' };
	return { ok: true, expiresAt: madridMidnight(addDays(day, 1)) };
}

/**
 * Cuentas bloqueadas (R07, D12): una cuenta bloqueada admite restas, para corregir saldo, pero no sumas. La regla vale para
 * cualquier bolsa.
 */
export function blockedAdjustmentAllowed(direction: 'credit' | 'debit', banned: boolean): boolean {
	return !(banned && direction === 'credit');
}

/**
 * Una resta cabe en el disponible del tipo elegido (R06, D05): `adjustableMicro` es el mínimo entre el saldo del tipo y el
 * disponible total. Exactamente igual cabe; un micro-crédito por encima no.
 */
export function debitFitsKind(amountMicro: number, adjustableMicro: number): boolean {
	return amountMicro <= adjustableMicro;
}
