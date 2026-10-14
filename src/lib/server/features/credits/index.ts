// API pública de `credits` (ARCHITECTURE.md §4). Las demás funcionalidades y las rutas solo importan este fichero. Solo
// `credits` escribe en las tablas de saldo.
import {
	adjust,
	applyChargeback,
	chargeAndRelease,
	expireBuckets,
	expireHolds,
	getBalance,
	grantPurchase,
	grantWelcome,
	releaseHold,
	releaseOpenHoldsOnStartup,
	type ChargebackOutcome,
	type PurchaseGrantOutcome,
	type RefundWithdrawOutcome,
	withdrawForRefund,
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
import {
	bucketsOf,
	lowBalanceView,
	setLowBalanceThreshold,
	movementsPage,
	type BucketView,
	type MovementRow,
	type MovementsPage
} from './service';
import { movementRowsOf, type MovementFact } from './csv-rows';

export { movementRowsOf, type MovementFact };
import type { EpochMs } from '$lib/shared/time';

export { balanceDto, welcomeDto, type BalanceDto, type WelcomeDto } from './presenters';
export { CREDITS_LOG_EVENTS, type CreditsLogFields } from './events';
export type {
	BucketView,
	MovementsPage,
	MovementRow,
	BalanceView,
	AdjustOutcome,
	ChargeOutcome,
	ReserveOutcome,
	WelcomeOutcome,
	CreditsDeps,
	PurchaseGrantOutcome,
	RefundWithdrawOutcome,
	ChargebackOutcome
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
	/** Acredita una compra completada: liquida deuda, bolsa paid con su pago y `has_real_purchase` si es real (BE-FR-24). */
	grantPurchase(input: {
		readonly userId: string;
		readonly paymentId: string;
		readonly amountMicro: number;
		readonly simulated: boolean;
	}): PurchaseGrantOutcome;
	/** Retira de la bolsa de la compra los créditos de un reembolso, con motivo y administrador (BE-FR-27). */
	withdrawForRefund(input: {
		readonly adminId: string;
		readonly userId: string;
		readonly paymentId: string;
		readonly amountMicro: number;
		readonly reason: string;
	}): RefundWithdrawOutcome;
	/** Contracargo: retira lo que quede de la compra y pasa el resto a deuda sin tope (BE-FR-28). Una vez por compra. */
	applyChargeback(input: {
		readonly userId: string;
		readonly paymentId: string;
	}): ChargebackOutcome;
	/** Umbral de saldo bajo y si el saldo está por debajo (W18, BE-FR-49.7). */
	lowBalance(userId: string): { readonly thresholdMicro: number | null; readonly isBelow: boolean };
	/** Guarda el umbral de saldo bajo (W27); `null` lo desactiva. */
	setLowBalanceThreshold(input: {
		readonly userId: string;
		readonly thresholdMicro: number | null;
	}): void;
	/** Bolsas con saldo para el resumen del panel (W18, BE-FR-49.1). */
	buckets(userId: string): BucketView[];
	/** Movimientos de la cuenta, de 25 en 25, con filtros de día y app (W22, BE-FR-49.3). */
	movements(input: {
		readonly userId: string;
		readonly fromMs: EpochMs | null;
		readonly toMs: EpochMs | null;
		readonly appId: string | null;
		readonly page: number;
	}): MovementsPage;
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
		grantPurchase: (input) => grantPurchase(deps, input),
		withdrawForRefund: (input) => withdrawForRefund(deps, input),
		applyChargeback: (input) => applyChargeback(deps, input),
		movements: (input) => movementsPage(deps, input),
		buckets: (userId) => bucketsOf(deps, userId),
		lowBalance: (userId) => lowBalanceView(deps, userId),
		setLowBalanceThreshold: (input) => {
			setLowBalanceThreshold(deps, input);
		},
		welcomeOf: (userId) => welcomeOf(deps, userId)
	};
}
