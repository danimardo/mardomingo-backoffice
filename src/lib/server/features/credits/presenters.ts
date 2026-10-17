// Modelos que salen de `credits` hacia la API y las páginas (contracts/api-v1.md 3.1; W19; T124). Solo los campos
// documentados: nunca bolsas, IDs internos ni la deuda sin nombrarla.
import { civilDateOf } from '$lib/shared/dates';
import type { EpochMs } from '$lib/shared/time';
import type { BalanceView } from './service';

/** `Balance` de la API (3.1): totales en micro-créditos. */
export interface BalanceDto {
	readonly totalMicro: number;
	readonly reservedMicro: number;
	readonly availableMicro: number;
	readonly freeMicro: number;
	readonly paidMicro: number;
	readonly debtMicro: number;
	readonly nextFreeExpiry: string | null;
}

export function balanceDto(view: BalanceView): BalanceDto {
	return {
		totalMicro: view.totalMicro,
		reservedMicro: view.reservedMicro,
		availableMicro: view.availableMicro,
		freeMicro: view.freeMicro,
		paidMicro: view.paidMicro,
		debtMicro: view.debtMicro,
		nextFreeExpiry:
			view.nextFreeExpiry === null ? null : new Date(view.nextFreeExpiry).toISOString()
	};
}

/** Bienvenida para W19: concedida con su importe y el día de caducidad, o no concedida (la forma ya la tenía otra cuenta). */
export interface WelcomeDto {
	readonly status: 'granted' | 'not_granted';
	readonly grantedMicro: number;
	readonly expiresOn: string | null;
}

export function welcomeDto(input: {
	readonly amountMicro: number | null;
	readonly expiresAt: EpochMs | null;
}): WelcomeDto {
	if (input.amountMicro === null)
		return { status: 'not_granted', grantedMicro: 0, expiresOn: null };
	return {
		status: 'granted',
		grantedMicro: input.amountMicro,
		expiresOn: input.expiresAt === null ? null : String(civilDateOf(input.expiresAt))
	};
}
