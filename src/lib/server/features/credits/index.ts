// API pública de `credits` (ARCHITECTURE.md §4). Las demás funcionalidades y las rutas solo importan este fichero. Solo
// `credits` escribe en las tablas de saldo.
import {
	adjust,
	chargeAndRelease,
	expireBuckets,
	expireHolds,
	getBalance,
	grantWelcome,
	releaseHold,
	releaseOpenHoldsOnStartup,
	reserve,
	welcomeOf,
	type AdjustOutcome,
	type BalanceView,
	type ChargeOutcome,
	type CreditsDeps,
	type ReserveOutcome,
	type WelcomeOutcome
} from './service';
import type { AuditDeps } from '$lib/server/features/audit';
import type { BucketKind } from './domain/ledger';
import { freeAccountsOpenHoldsMicro, realPurchaseUserIds, type ReleaseReason } from './repository';
import type { EpochMs } from '$lib/shared/time';

export { balanceDto, welcomeDto, type BalanceDto, type WelcomeDto } from './presenters';
export { CREDITS_LOG_EVENTS, type CreditsLogFields } from './events';
export type {
	BalanceView,
	AdjustOutcome,
	ChargeOutcome,
	ReserveOutcome,
	WelcomeOutcome,
	CreditsDeps
};

export interface CreditsConfig extends CreditsDeps {
	readonly auditDeps: AuditDeps;
}

/** Operaciones de créditos para el resto de la aplicación. */
export interface Credits {
	/** Bienvenida al verificar: una por cuenta y por forma normalizada del email (BE-FR-12). Su propia transacción. */
	grantWelcome(input: {
		readonly userId: string;
		readonly emailNormalizedHash: string;
	}): WelcomeOutcome;
	/** Reserva el coste máximo antes de llamar al proveedor (BE-FR-71). */
	reserve(input: {
		readonly userId: string;
		readonly appId: string;
		readonly operationId: string;
		readonly amountMicro: number;
	}): ReserveOutcome;
	/** Cobra el coste real y libera la reserva en una transacción (BE-FR-17). */
	chargeAndRelease(input: {
		readonly holdId: string;
		readonly realCostMicro: number;
	}): ChargeOutcome;
	/** Libera una reserva sin cobrar. */
	release(input: {
		readonly holdId: string;
		readonly reason: Exclude<ReleaseReason, 'consumed'>;
	}): boolean;
	/** Reservas abiertas al arrancar: se liberan como interrumpidas (T125). */
	releaseOpenHoldsOnStartup(): number;
	/** Reservas que han superado su caducidad: se liberan sin cobro (BE-FR-71). */
	expireHolds(): number;
	/** Caducidad de bolsas gratuitas (BE-FR-16). */
	expireBuckets(): number;
	/** Ajuste del administrador con motivo y auditoría (BE-FR-18). */
	adjust(input: {
		readonly adminId: string;
		readonly userId: string;
		readonly direction: 'credit' | 'debit';
		readonly kind: BucketKind;
		readonly amountMicro: number;
		readonly expiresAt?: EpochMs | null;
		readonly reason: string;
	}): AdjustOutcome;
	/** Saldo: total, reservado y disponible (BE-FR-71 CA2). */
	getBalance(userId: string): BalanceView;
	/** Cuentas de la lista que tienen compra real; el resto son cuentas sin compras reales (BE-FR-11 CA2). */
	realPurchaseUserIds(userIds: readonly string[]): ReadonlySet<string>;
	/** Micro-créditos reservados en curso de las cuentas sin compra real (BE-FR-46 CA1). */
	freeAccountsOpenHoldsMicro(): number;
	/** Bolsa de bienvenida de la cuenta, para W19. */
	welcomeOf(
		userId: string
	): { readonly amountMicro: number; readonly expiresAt: EpochMs | null } | null;
}

export function createCredits(config: CreditsConfig): Credits {
	const deps: CreditsDeps & { readonly auditDeps: AuditDeps } = config;
	return {
		grantWelcome: (input) => grantWelcome(deps, input),
		reserve: (input) => reserve(deps, input),
		chargeAndRelease: (input) => chargeAndRelease(deps, input),
		release: (input) => releaseHold(deps, input),
		releaseOpenHoldsOnStartup: () => releaseOpenHoldsOnStartup(deps),
		expireHolds: () => expireHolds(deps),
		expireBuckets: () => expireBuckets(deps),
		adjust: (input) => adjust(deps, input),
		getBalance: (userId) => getBalance(deps, userId),
		realPurchaseUserIds: (userIds) => realPurchaseUserIds(deps.db, userIds),
		freeAccountsOpenHoldsMicro: () => freeAccountsOpenHoldsMicro(deps.db),
		welcomeOf: (userId) => welcomeOf(deps, userId)
	};
}
