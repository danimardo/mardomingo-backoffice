// Servicio de `credits` (BE-FR-11.5, 12–18, 71; T123). Cada operación abre su propia transacción `BEGIN IMMEDIATE`, carga el
// estado de la cuenta, aplica una transición del dominio puro (`domain/ledger.ts`) y persiste lo que devuelve. Como
// better-sqlite3 es síncrono, dos operaciones no se pueden intercalar dentro de una transacción.
import { and, asc, desc, eq, gt, gte, lte } from 'drizzle-orm';
import type { Clock } from '$lib/server/adapters/clock/clock';
import type { Db } from '$lib/server/db/client';
import { immediateTransaction, type Tx } from '$lib/server/db/tx';
import { recordEntry, type AuditDeps } from '$lib/server/features/audit';
import { getSetting, type AppsDeps } from '$lib/server/features/apps';
import type { Logger } from '$lib/server/logging/logger';
import { AppError } from '$lib/server/shared/errors';
import type { IdGenerator, IdKind } from '$lib/server/shared/ids';
import { toEpochMs, type CivilDate, type EpochMs } from '$lib/shared/time';
import { civilDateOf, startOfMadridDay } from '$lib/shared/dates';
import { toMicro } from '$lib/shared/money';
import { dailyCapVerdict } from './domain/daily-cap';
import { applyForfeit } from './domain/forfeit';
import { lowBalanceVerdict, type LowBalanceEvent } from './domain/low-balance';
import {
	applyCredit,
	applyExpiry,
	applyNegativeAdjustment,
	applyUsage,
	applyChargeback as applyChargebackTransition,
	applyRefundWithdrawal,
	applyWelcome,
	balanceOf,
	canGrantWelcome,
	canReserve,
	type BucketKind,
	type BucketSource,
	type LedgerState,
	type LineType
} from './domain/ledger';
import { adjustmentKeys, creditBuckets, creditMovements } from './schema';
import {
	accountHasWelcome,
	closeHold,
	expiredFreeBucketUsers,
	hasRealPurchaseOf,
	hasWelcomeGrant,
	insertHold,
	insertWelcomeGrant,
	loadState,
	movementRows,
	nextFreeExpiry,
	openHoldOf,
	openHolds,
	persistState,
	reservedOf,
	type ReleaseReason,
	usersWithBucketMismatch,
	usersWithDebtMismatch,
	insertMovements,
	usageSince,
	bucketOfPayment,
	movementExistsForPayment,
	refundedMicroOf,
	setRealPurchase,
	lowBalanceStateOf,
	setLowBalanceNotified,
	setLowBalanceThreshold as writeLowBalanceThreshold,
	freeBucketsExpiringSoon,
	markExpiryWarned
} from './repository';

export interface CreditsDeps {
	readonly db: Db;
	readonly logger: Logger;
	readonly clock: Clock;
	readonly ids: IdGenerator;
	readonly apps: AppsDeps;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function numberSetting(deps: CreditsDeps, key: Parameters<typeof getSetting>[1]): number {
	const value = getSetting(deps.apps, key);
	if (typeof value !== 'number')
		throw new AppError('INTERNAL_ERROR', { reason: 'setting_missing' });
	return value;
}

/** Ids nuevos con su prefijo, para cada fila que crea una transición. */
function idsOf(deps: CreditsDeps, prefix: IdKind): () => string {
	return () => deps.ids(prefix);
}

// ---------------------------------------------------------------------------------------------------------------------
// Bienvenida (BE-FR-12, BE-FR-11.5, D10)

export type WelcomeOutcome =
	| { readonly status: 'granted'; readonly amountMicro: number; readonly expiresAt: EpochMs }
	| { readonly status: 'denied'; readonly reason: 'hash_granted' | 'account_has_welcome' };

/**
 * Concede la bolsa de bienvenida al verificar (BE-FR-12). `emailNormalizedHash` es el HMAC del email normalizado
 * (`EMAIL_HASH_KEY`): una forma ya concedida no vuelve a recibirla, aunque sea otra cuenta (CA1 de BE-FR-11.5).
 */
export function grantWelcome(
	deps: CreditsDeps,
	input: { readonly userId: string; readonly emailNormalizedHash: string }
): WelcomeOutcome {
	return immediateTransaction(deps.db, (tx) => {
		const decision = canGrantWelcome({
			hashGranted: hasWelcomeGrant(tx, input.emailNormalizedHash),
			accountHasWelcome: accountHasWelcome(tx, input.userId)
		});
		if (!decision.ok) {
			deps.logger.emit('credits.welcome.denied', { reason: decision.reason });
			return { status: 'denied', reason: decision.reason };
		}
		const now = deps.clock.now();
		const amount = numberSetting(deps, 'welcome_credits');
		const expiresAt = now + numberSetting(deps, 'free_credits_expiry_days') * DAY_MS;
		const id = deps.ids('bkt');
		const before: LedgerState = loadState(tx, input.userId);
		const result = applyWelcome(before, { id, amount, expiresAt, createdAt: now });

		insertWelcomeGrant(tx, input.emailNormalizedHash, now);
		persistState(tx, input.userId, before, result.state, now);
		insertMovements(tx, movementRows(input.userId, result.lines), idsOf(deps, 'mov'), now);
		deps.logger.emit('credits.bucket.granted', { kind: 'free', source: 'welcome' });
		return { status: 'granted', amountMicro: amount, expiresAt: toEpochMs(expiresAt) };
	});
}

// ---------------------------------------------------------------------------------------------------------------------
// Reservas (BE-FR-71)

export type ReserveOutcome =
	| { readonly ok: true; readonly holdId: string }
	| {
			readonly ok: false;
			readonly reason: 'debt_open' | 'insufficient_balance' | 'daily_free_limit';
			readonly requiredMicro?: number;
			readonly availableMicro?: number;
	  };

/**
 * Reserva el coste máximo estimado antes de llamar al proveedor (BE-FR-71). Sin deuda abierta, con saldo disponible ≥
 * `min_balance_to_operate` y cabiendo en `disponible + (max_debt − deuda)`. Si no cabe, no se crea nada.
 */
export function reserve(
	deps: CreditsDeps,
	input: {
		readonly userId: string;
		readonly appId: string;
		readonly operationId: string;
		readonly amountMicro: number;
	}
): ReserveOutcome {
	return immediateTransaction(deps.db, (tx) => {
		const state = loadState(tx, input.userId);
		const verdict = canReserve({
			balance: balanceOf(state),
			reserved: reservedOf(tx, input.userId),
			debt: state.debt,
			maxDebt: numberSetting(deps, 'max_debt'),
			minBalance: numberSetting(deps, 'min_balance_to_operate'),
			amount: input.amountMicro
		});
		if (!verdict.ok) {
			deps.logger.emit('credits.hold.rejected', { reason: verdict.reason });
			return verdict.reason === 'debt_open'
				? { ok: false, reason: 'debt_open' }
				: {
						ok: false,
						reason: 'insufficient_balance',
						requiredMicro: verdict.requiredMicro,
						availableMicro: verdict.availableMicro
					};
		}
		const now = deps.clock.now();
		// Tope diario de cuentas sin compra real (FR-022, BE-FR-11.6): cobros del día de Madrid + reservas activas + la nueva.
		const dailyCap = dailyCapVerdict({
			costsTodayMicro: usageSince(tx, input.userId, startOfMadridDay(now)),
			activeHoldsMicro: reservedOf(tx, input.userId),
			newHoldMicro: input.amountMicro,
			capMicro: numberSetting(deps, 'daily_cap_no_purchase'),
			hasRealPurchase: hasRealPurchaseOf(tx, input.userId)
		});
		if (!dailyCap.ok) {
			deps.logger.emit('credits.hold.rejected', { reason: dailyCap.reason });
			return { ok: false, reason: 'daily_free_limit' };
		}
		const id = deps.ids('hld');
		insertHold(tx, {
			id,
			userId: input.userId,
			appId: input.appId,
			operationId: input.operationId,
			amountMicro: input.amountMicro,
			createdAt: now,
			expiresAt: now + numberSetting(deps, 'hold_ttl_seconds') * 1000
		});
		deps.logger.emit('credits.hold.created', {});
		return { ok: true, holdId: id };
	});
}

export type ChargeOutcome =
	| {
			readonly ok: true;
			readonly chargedMicro: number;
			readonly absorbedMicro: number;
			/** Evento del aviso de saldo bajo tras el cobro, si lo hubo (BE-FR-49.7). */
			readonly lowBalance: LowBalanceEvent;
	  }
	| { readonly ok: false; readonly reason: 'hold_not_open' };

/**
 * Aviso de saldo bajo tras un cambio de saldo (BE-FR-49.7): avisa una vez al cruzar hacia abajo y rearma al superar el
 * umbral. El correo lo envía quien llamó, fuera de la transacción: `credits` no puede leer `accounts` (orden de funcionalidades).
 */
function lowBalanceAfter(deps: CreditsDeps, tx: Tx, userId: string, now: EpochMs): LowBalanceEvent {
	const state = lowBalanceStateOf(tx, userId);
	const verdict = lowBalanceVerdict({
		balanceMicro: balanceOf(loadState(tx, userId)),
		thresholdMicro: state.thresholdMicro,
		notified: state.notified
	});
	if (verdict.notified !== state.notified) setLowBalanceNotified(tx, userId, verdict.notified, now);
	if (verdict.event !== null) {
		deps.logger.emit('credits.low_balance.crossed', {
			status: verdict.event
		});
	}
	return verdict.event;
}

/**
 * Cobra el coste real y libera la reserva en la misma transacción (BE-FR-71, BE-FR-17). Lo que supera el saldo pasa a
 * deuda hasta `max_debt`; el exceso lo absorbe el administrador (sin movimiento, D8).
 */
export function chargeAndRelease(
	deps: CreditsDeps,
	input: { readonly holdId: string; readonly realCostMicro: number }
): ChargeOutcome {
	return immediateTransaction(deps.db, (tx) => {
		const hold = openHoldOf(tx, input.holdId);
		if (hold === undefined) return { ok: false, reason: 'hold_not_open' };
		const now = deps.clock.now();
		const before = loadState(tx, hold.userId);
		const result = applyUsage(before, {
			amount: input.realCostMicro,
			maxDebt: numberSetting(deps, 'max_debt')
		});

		persistState(tx, hold.userId, before, result.state, now);
		insertMovements(
			tx,
			movementRows(hold.userId, result.lines, { operationId: hold.operationId, appId: hold.appId }),
			idsOf(deps, 'mov'),
			now
		);
		closeHold(tx, hold.id, 'consumed', now);
		deps.logger.emit('credits.charge.applied', {});
		if (result.debtAdded > 0) deps.logger.emit('credits.debt.created', {});
		if (result.absorbed > 0) deps.logger.emit('credits.debt.absorbed', {});
		return {
			ok: true,
			chargedMicro: input.realCostMicro - result.absorbed,
			absorbedMicro: result.absorbed,
			lowBalance: lowBalanceAfter(deps, tx, hold.userId, now)
		};
	});
}

/** Libera una reserva sin cobrar (BE-FR-21 y similares). No hay movimiento: las reservas no son movimientos (BE-FR-15). */
export function releaseHold(
	deps: CreditsDeps,
	input: { readonly holdId: string; readonly reason: Exclude<ReleaseReason, 'consumed'> }
): boolean {
	return immediateTransaction(deps.db, (tx) => {
		const hold = openHoldOf(tx, input.holdId);
		if (hold === undefined) return false;
		closeHold(tx, hold.id, input.reason, deps.clock.now());
		deps.logger.emit('credits.hold.released', { reason: input.reason });
		return true;
	});
}

/** Al arrancar, las reservas abiertas se liberan como interrumpidas, sin cobro (BE-FR-71, T125). */
export function releaseOpenHoldsOnStartup(deps: CreditsDeps): number {
	return immediateTransaction(deps.db, (tx) => {
		const now = deps.clock.now();
		const open = openHolds(tx);
		for (const hold of open) closeHold(tx, hold.id, 'interrupted', now);
		if (open.length > 0)
			deps.logger.emit('credits.hold.released_on_startup', { count: open.length });
		return open.length;
	});
}

/** Reservas abiertas que han superado su caducidad: se liberan sin cobro (BE-FR-71). */
export function expireHolds(deps: CreditsDeps): number {
	return immediateTransaction(deps.db, (tx) => {
		const now = deps.clock.now();
		const stale = openHolds(tx, { expiredBefore: now });
		for (const hold of stale) {
			closeHold(tx, hold.id, 'expired', now);
			deps.logger.emit('credits.hold.expired', {});
		}
		return stale.length;
	});
}

// ---------------------------------------------------------------------------------------------------------------------
// Ajustes manuales (BE-FR-18, D-16)

export type AdjustOutcome =
	| { readonly ok: true; readonly auditId: string }
	| { readonly ok: false; readonly reason: 'exceeds_available' | 'repeated' };

/**
 * Ajuste del administrador (BE-FR-18): suma (liquidando primero la deuda) o resta (nunca más que el disponible, D-16).
 * Motivo obligatorio y entrada de auditoría en la misma transacción (BE-FR-55).
 */
export function adjust(
	deps: CreditsDeps & { readonly auditDeps: AuditDeps },
	input: {
		readonly adminId: string;
		readonly userId: string;
		readonly direction: 'credit' | 'debit';
		readonly kind: BucketKind;
		readonly amountMicro: number;
		readonly expiresAt?: EpochMs | null | undefined;
		readonly reason: string;
		/** Clave del formulario: un envío repetido con la misma clave no vuelve a aplicar el ajuste (T307, 15.12). */
		readonly idempotencyKey: string;
	}
): AdjustOutcome {
	return immediateTransaction(deps.db, (tx): AdjustOutcome => {
		const now = deps.clock.now();
		if (
			tx.select().from(adjustmentKeys).where(eq(adjustmentKeys.key, input.idempotencyKey)).get() !==
			undefined
		)
			return { ok: false, reason: 'repeated' };
		const before = loadState(tx, input.userId);
		const snapshot = (state: LedgerState) => ({
			balanceMicro: balanceOf(state),
			debtMicro: state.debt
		});

		if (input.direction === 'credit') {
			const expiresAt =
				input.kind === 'free'
					? (input.expiresAt ?? now + numberSetting(deps, 'free_credits_expiry_days') * DAY_MS)
					: null;
			const id = deps.ids('bkt');
			const result = applyCredit(before, {
				id,
				kind: input.kind,
				source: 'adjustment',
				amount: input.amountMicro,
				expiresAt,
				createdAt: now,
				type: 'adjustment'
			});
			persistState(tx, input.userId, before, result.state, now);
			lowBalanceAfter(deps, tx, input.userId, now);
			insertMovements(
				tx,
				movementRows(input.userId, result.lines, {
					adminId: input.adminId,
					adminReason: input.reason
				}),
				idsOf(deps, 'mov'),
				now
			);
			if (result.lines.some((line) => line.type === 'debt_settlement'))
				deps.logger.emit('credits.debt.settled', {});
			deps.logger.emit('credits.adjustment.applied', { direction: 'credit', kind: input.kind });
			const auditId = recordEntry(
				tx,
				{
					adminId: input.adminId,
					action: 'credits.adjust',
					entity: 'user',
					entityId: input.userId,
					before: snapshot(before),
					after: snapshot(result.state),
					reason: input.reason
				},
				deps.auditDeps
			);
			tx.insert(adjustmentKeys).values({ key: input.idempotencyKey, createdAt: now }).run();
			return { ok: true, auditId };
		}

		const available = balanceOf(before) - reservedOf(tx, input.userId);
		const result = applyNegativeAdjustment(before, {
			kind: input.kind,
			amount: input.amountMicro,
			available
		});
		if (!result.ok) {
			deps.logger.emit('credits.adjustment.rejected', { reason: result.reason });
			return result;
		}
		persistState(tx, input.userId, before, result.state, now);
		lowBalanceAfter(deps, tx, input.userId, now);
		insertMovements(
			tx,
			movementRows(input.userId, result.lines, {
				adminId: input.adminId,
				adminReason: input.reason
			}),
			idsOf(deps, 'mov'),
			now
		);
		deps.logger.emit('credits.adjustment.applied', { direction: 'debit', kind: input.kind });
		const auditId = recordEntry(
			tx,
			{
				adminId: input.adminId,
				action: 'credits.adjust',
				entity: 'user',
				entityId: input.userId,
				before: snapshot(before),
				after: snapshot(result.state),
				reason: input.reason
			},
			deps.auditDeps
		);
		tx.insert(adjustmentKeys).values({ key: input.idempotencyKey, createdAt: now }).run();
		return { ok: true, auditId };
	});
}

// ---------------------------------------------------------------------------------------------------------------------
// Caducidad (BE-FR-16)

/** Pone a cero las bolsas gratuitas caducadas, de todas las cuentas afectadas. Devuelve cuántas cuentas se tocaron. */
export function expireBuckets(deps: CreditsDeps): number {
	const now = deps.clock.now();
	const users = immediateTransaction(deps.db, (tx) => expiredFreeBucketUsers(tx, now));
	let touched = 0;
	for (const userId of users) {
		immediateTransaction(deps.db, (tx) => {
			const before = loadState(tx, userId);
			const result = applyExpiry(before, now);
			if (result.lines.length === 0) return;
			persistState(tx, userId, before, result.state, now);
			insertMovements(tx, movementRows(userId, result.lines), idsOf(deps, 'mov'), now);
			deps.logger.emit('credits.expiry.applied', { count: result.lines.length });
			touched += 1;
		});
	}
	return touched;
}

/**
 * Usuarios con una bolsa gratuita que caduca en la ventana `windowMs` y que aún no han recibido el aviso (T330). Marca cada
 * bolsa antes de devolver el usuario, así que el aviso sale una sola vez aunque la tarea se repita.
 */
export function warnExpiringBuckets(
	deps: CreditsDeps,
	input: { readonly windowMs: number }
): string[] {
	const now = deps.clock.now();
	const users = immediateTransaction(deps.db, (tx) => {
		const buckets = freeBucketsExpiringSoon(tx, now, now + input.windowMs);
		for (const bucket of buckets) markExpiryWarned(tx, bucket.id, now);
		return [...new Set(buckets.map((bucket) => bucket.userId))];
	});
	if (users.length > 0) deps.logger.emit('credits.expiry.warned', { count: users.length });
	return users;
}

// ---------------------------------------------------------------------------------------------------------------------
// Borrado de la cuenta (BE-FR-07 CA4, D-15)

/**
 * Pone a cero las bolsas con saldo con un movimiento `forfeit` por bolsa y borra el umbral de saldo bajo (dato personal
 * de preferencia). La deuda no se anula. Solo la llama `privacy`, dentro de la transacción del borrado: abrir una
 * transacción aquí la convierte en un punto de guardado de esa.
 */
export function forfeitAll(
	deps: CreditsDeps,
	userId: string,
	reason: 'user' | 'inactivity' = 'user'
): { readonly forfeitedMicro: number; readonly buckets: number } {
	return immediateTransaction(deps.db, (tx) => {
		const now = deps.clock.now();
		const before = loadState(tx, userId);
		const result = applyForfeit(before);
		if (result.lines.length > 0) {
			persistState(tx, userId, before, result.state, now);
			insertMovements(tx, movementRows(userId, result.lines), idsOf(deps, 'mov'), now);
			deps.logger.emit('credits.balance.forfeited', { reason, count: result.lines.length });
		}
		writeLowBalanceThreshold(tx, userId, null, now);
		return {
			forfeitedMicro: result.lines.reduce((sum, line) => sum - line.amount, 0),
			buckets: result.lines.length
		};
	});
}

/** Libera las reservas abiertas de la cuenta, sin cobro (BE-FR-07 CA1; data-model §6). Solo la llama `privacy`. */
export function releaseOpenHolds(deps: CreditsDeps, userId: string): number {
	return immediateTransaction(deps.db, (tx) => {
		const now = deps.clock.now();
		const open = openHolds(tx, { userId });
		for (const hold of open) closeHold(tx, hold.id, 'released', now);
		return open.length;
	});
}

// ---------------------------------------------------------------------------------------------------------------------
// Saldo (CA2 de BE-FR-71)

export interface BalanceView {
	readonly totalMicro: number;
	readonly reservedMicro: number;
	readonly availableMicro: number;
	readonly freeMicro: number;
	readonly paidMicro: number;
	readonly debtMicro: number;
	readonly nextFreeExpiry: EpochMs | null;
}

/** Próxima caducidad de una bolsa gratuita, tipada para el saldo. */
function nextFreeIso(tx: Tx, userId: string): EpochMs | null {
	const next = nextFreeExpiry(tx, userId);
	return next === null ? null : toEpochMs(next);
}

/** Saldo de una cuenta: total, reservado y disponible, y su desglose por tipo (CA2 de BE-FR-71). */
export function getBalance(deps: CreditsDeps, userId: string): BalanceView {
	return immediateTransaction(deps.db, (tx) => {
		const state = loadState(tx, userId);
		const reservedMicro = reservedOf(tx, userId);
		const totalMicro = balanceOf(state);
		const freeMicro = state.buckets
			.filter((item) => item.kind === 'free')
			.reduce((sum, item) => sum + item.remaining, 0);
		const paidMicro = state.buckets
			.filter((item) => item.kind === 'paid')
			.reduce((sum, item) => sum + item.remaining, 0);
		return {
			totalMicro,
			reservedMicro,
			availableMicro: totalMicro - reservedMicro,
			freeMicro,
			paidMicro,
			debtMicro: state.debt,
			nextFreeExpiry: nextFreeIso(tx, userId)
		};
	});
}

/** Bienvenida de la cuenta (W19): importe y caducidad de su bolsa de bienvenida, o `null` si no la tiene. */
export function welcomeOf(
	deps: CreditsDeps,
	userId: string
): { readonly amountMicro: number; readonly expiresAt: EpochMs | null } | null {
	const row = deps.db
		.select({ initial: creditBuckets.initialMicro, expiresAt: creditBuckets.expiresAt })
		.from(creditBuckets)
		.where(and(eq(creditBuckets.userId, userId), eq(creditBuckets.source, 'welcome')))
		.get();
	return row === undefined ? null : { amountMicro: row.initial, expiresAt: row.expiresAt };
}

// ---------------------------------------------------------------------------------------------------------------------
// Compras, reembolsos y contracargos (BE-FR-24/CA1, BE-FR-25/CA3, BE-FR-27, BE-FR-28; T233)

export type PurchaseGrantOutcome =
	{ readonly status: 'granted' } | { readonly status: 'already_granted' };

/**
 * Acredita una compra completada (BE-FR-24): liquida primero la deuda, crea una bolsa `paid` con su pago y fija
 * `has_real_purchase` solo si la compra es real (BE-FR-25 CA3). Un segundo intento con el mismo pago no acredita.
 */
export function grantPurchase(
	deps: CreditsDeps,
	input: {
		readonly userId: string;
		readonly paymentId: string;
		readonly amountMicro: number;
		readonly simulated: boolean;
	}
): PurchaseGrantOutcome {
	return immediateTransaction(deps.db, (tx): PurchaseGrantOutcome => {
		if (bucketOfPayment(tx, input.paymentId) !== undefined) return { status: 'already_granted' };
		const now = deps.clock.now();
		const before = loadState(tx, input.userId);
		const result = applyCredit(before, {
			id: deps.ids('bkt'),
			kind: 'paid',
			source: 'purchase',
			amount: input.amountMicro,
			expiresAt: null,
			createdAt: now,
			type: 'purchase',
			paymentId: input.paymentId,
			simulated: input.simulated
		});

		persistState(tx, input.userId, before, result.state, now);
		lowBalanceAfter(deps, tx, input.userId, now);
		insertMovements(
			tx,
			movementRows(input.userId, result.lines, { paymentId: input.paymentId }),
			idsOf(deps, 'mov'),
			now
		);
		if (!input.simulated) setRealPurchase(tx, input.userId, now);
		if (result.lines.some((line) => line.type === 'debt_settlement'))
			deps.logger.emit('credits.debt.settled', {});
		deps.logger.emit('credits.bucket.granted', { kind: 'paid', source: 'purchase' });
		return { status: 'granted' };
	});
}

export type RefundWithdrawOutcome =
	| { readonly ok: true }
	| {
			readonly ok: false;
			readonly reason: 'no_purchase_bucket' | 'credits_exceed_bucket' | 'amount_not_positive';
	  };

/**
 * Retira de la bolsa de la compra los créditos de un reembolso (BE-FR-27). Nunca más que su saldo y nunca crea deuda;
 * el motivo y el administrador van en el movimiento `refund`. La auditoría la registra `payments` en la misma acción.
 */
export function withdrawForRefund(
	deps: CreditsDeps,
	input: {
		readonly adminId: string;
		readonly userId: string;
		readonly paymentId: string;
		readonly amountMicro: number;
		readonly reason: string;
	}
): RefundWithdrawOutcome {
	return immediateTransaction(deps.db, (tx): RefundWithdrawOutcome => {
		const bucket = bucketOfPayment(tx, input.paymentId);
		if (bucket === undefined) return { ok: false, reason: 'no_purchase_bucket' };
		const before = loadState(tx, input.userId);
		const result = applyRefundWithdrawal(before, {
			bucketId: bucket.id,
			amount: input.amountMicro
		});
		if (!result.ok) {
			return {
				ok: false,
				reason: result.reason === 'exceeds_bucket' ? 'credits_exceed_bucket' : 'amount_not_positive'
			};
		}
		const now = deps.clock.now();
		persistState(tx, input.userId, before, result.state, now);
		insertMovements(
			tx,
			movementRows(input.userId, result.lines, {
				paymentId: input.paymentId,
				adminId: input.adminId,
				adminReason: input.reason
			}),
			idsOf(deps, 'mov'),
			now
		);
		deps.logger.emit('credits.refund.applied', {});
		return { ok: true };
	});
}

export type ChargebackOutcome =
	| { readonly status: 'applied'; readonly withdrawnMicro: number; readonly debtAddedMicro: number }
	| { readonly status: 'already_applied' }
	| { readonly status: 'no_purchase_bucket' };

/**
 * Contracargo (BE-FR-28, H-12): recupera la compra menos lo ya retirado por reembolsos. Lo que la bolsa no cubre pasa a
 * deuda sin el tope `max_debt`. Una vez por compra: un evento repetido no repite nada.
 */
export function applyChargeback(
	deps: CreditsDeps,
	input: { readonly userId: string; readonly paymentId: string }
): ChargebackOutcome {
	return immediateTransaction(deps.db, (tx): ChargebackOutcome => {
		const bucket = bucketOfPayment(tx, input.paymentId);
		if (bucket === undefined) return { status: 'no_purchase_bucket' };
		if (movementExistsForPayment(tx, input.paymentId, 'chargeback'))
			return { status: 'already_applied' };
		const before = loadState(tx, input.userId);
		const targetMicro = bucket.initial - refundedMicroOf(tx, input.paymentId);
		const result = applyChargebackTransition(before, { bucketId: bucket.id, targetMicro });
		const now = deps.clock.now();
		persistState(tx, input.userId, before, result.state, now);
		insertMovements(
			tx,
			movementRows(input.userId, result.lines, { paymentId: input.paymentId }),
			idsOf(deps, 'mov'),
			now
		);
		deps.logger.emit('credits.chargeback.applied', {});
		return {
			status: 'applied',
			withdrawnMicro: result.withdrawnMicro,
			debtAddedMicro: result.debtAddedMicro
		};
	});
}

// ---------------------------------------------------------------------------------------------------------------------
// Movimientos del panel (BE-FR-49.3, UX-09; T262)

export const MOVEMENTS_PAGE_SIZE = 25;

export interface MovementRow {
	readonly createdAt: EpochMs;
	readonly type: LineType;
	readonly amountMicro: number;
	readonly appId: string | null;
}

export interface MovementsPage {
	readonly rows: readonly MovementRow[];
	readonly pagination: {
		readonly page: number;
		readonly hasPrevious: boolean;
		readonly hasNext: boolean;
	};
}

/**
 * Movimientos de una cuenta por fecha, de 25 en 25 (BE-FR-49.3; UX-09). Por defecto, los más recientes primero. Sin motivos
 * del administrador ni ids de bolsa: el panel no los muestra. El rango se da en milisegundos (el llamador lo calcula con el
 * día de Madrid).
 */
export function movementsPage(
	deps: CreditsDeps,
	input: {
		readonly userId: string;
		readonly fromMs: EpochMs | null;
		readonly toMs: EpochMs | null;
		readonly appId: string | null;
		readonly page: number;
		readonly order?: 'asc' | 'desc';
	}
): MovementsPage {
	const conditions = [eq(creditMovements.userId, input.userId)];
	if (input.fromMs !== null) conditions.push(gte(creditMovements.createdAt, input.fromMs));
	if (input.toMs !== null) conditions.push(lte(creditMovements.createdAt, input.toMs));
	if (input.appId !== null) conditions.push(eq(creditMovements.appId, input.appId));
	const byDate = input.order === 'asc' ? asc : desc;
	const found = deps.db
		.select({
			createdAt: creditMovements.createdAt,
			type: creditMovements.type,
			amountMicro: creditMovements.amountMicro,
			appId: creditMovements.appId
		})
		.from(creditMovements)
		.where(and(...conditions))
		.orderBy(byDate(creditMovements.createdAt), byDate(creditMovements.id))
		.limit(MOVEMENTS_PAGE_SIZE + 1)
		.offset((input.page - 1) * MOVEMENTS_PAGE_SIZE)
		.all();
	return {
		rows: found.slice(0, MOVEMENTS_PAGE_SIZE),
		pagination: {
			page: input.page,
			hasPrevious: input.page > 1,
			hasNext: found.length > MOVEMENTS_PAGE_SIZE
		}
	};
}

export interface MovementExportRow extends MovementRow {
	readonly paymentId: string | null;
}

/** Todos los movimientos de la cuenta, del más antiguo al más reciente, para la exportación RGPD (BE-FR-08). */
export function movementsForExport(deps: CreditsDeps, userId: string): MovementExportRow[] {
	return deps.db
		.select({
			createdAt: creditMovements.createdAt,
			type: creditMovements.type,
			amountMicro: creditMovements.amountMicro,
			appId: creditMovements.appId,
			paymentId: creditMovements.paymentId
		})
		.from(creditMovements)
		.where(eq(creditMovements.userId, userId))
		.orderBy(asc(creditMovements.createdAt), asc(creditMovements.id))
		.all();
}

export interface BucketView {
	readonly kind: BucketKind;
	readonly source: BucketSource;
	readonly remainingMicro: number;
	/** Día de Madrid en que caduca la bolsa gratuita; nulo en las de pago (BE-FR-16). */
	readonly expiresOn: CivilDate | null;
	readonly simulated: boolean;
}

/** Bolsas con saldo de la cuenta, para el resumen del panel (BE-FR-49.1). Sin ids internos. */
export function bucketsOf(deps: CreditsDeps, userId: string): BucketView[] {
	return deps.db
		.select({
			kind: creditBuckets.kind,
			source: creditBuckets.source,
			remainingMicro: creditBuckets.remainingMicro,
			expiresAt: creditBuckets.expiresAt,
			simulated: creditBuckets.simulated
		})
		.from(creditBuckets)
		.where(and(eq(creditBuckets.userId, userId), gt(creditBuckets.remainingMicro, toMicro(0))))
		.orderBy(asc(creditBuckets.createdAt), asc(creditBuckets.id))
		.all()
		.map((row) => ({
			kind: row.kind,
			source: row.source,
			remainingMicro: row.remainingMicro,
			expiresOn: row.expiresAt === null ? null : civilDateOf(row.expiresAt),
			simulated: row.simulated
		}));
}

/** Umbral de saldo bajo de la cuenta y si el saldo total está por debajo (W18, BE-FR-49.7). Sin umbral, nunca está por debajo. */
/** Guarda el umbral de saldo bajo de la cuenta; `null` lo desactiva (W27, BE-FR-49.7). */
export function setLowBalanceThreshold(
	deps: CreditsDeps,
	input: { readonly userId: string; readonly thresholdMicro: number | null }
): void {
	immediateTransaction(deps.db, (tx) => {
		writeLowBalanceThreshold(
			tx,
			input.userId,
			input.thresholdMicro === null ? null : toMicro(input.thresholdMicro),
			toEpochMs(deps.clock.now())
		);
	});
}

export function lowBalanceView(
	deps: CreditsDeps,
	userId: string
): { readonly thresholdMicro: number | null; readonly isBelow: boolean } {
	const state = lowBalanceStateOf(deps.db, userId);
	const total = getBalance(deps, userId).totalMicro;
	return {
		thresholdMicro: state.thresholdMicro,
		isBelow: state.thresholdMicro !== null && total < state.thresholdMicro
	};
}

// ---------------------------------------------------------------------------------------------------------------------
// Comprobación del ledger (BE-FR-15 CA1, SC-003)

/**
 * Comprueba que el saldo materializado de cada cuenta se puede reconstruir a partir de los movimientos: el resto de cada bolsa
 * es la suma de sus movimientos y la deuda es la suma cambiada de signo de las líneas sin bolsa. Devuelve las cuentas con
 * discrepancia y registra un único `credits.ledger.mismatch` con su recuento (nunca las identidades). No escribe nada.
 */
export function checkLedger(deps: Pick<CreditsDeps, 'db' | 'logger'>): string[] {
	const affected = new Set([
		...usersWithBucketMismatch(deps.db),
		...usersWithDebtMismatch(deps.db)
	]);
	if (affected.size > 0) deps.logger.emit('credits.ledger.mismatch', { count: affected.size });
	return [...affected].sort();
}
