// Servicio de `credits` (BE-FR-11.5, 12–18, 71; T123). Cada operación abre su propia transacción `BEGIN IMMEDIATE`, carga el
// estado de la cuenta, aplica una transición del dominio puro (`domain/ledger.ts`) y persiste lo que devuelve. Como
// better-sqlite3 es síncrono, dos operaciones no se pueden intercalar dentro de una transacción.
import { and, eq } from 'drizzle-orm';
import type { Clock } from '$lib/server/adapters/clock/clock';
import type { Db } from '$lib/server/db/client';
import { immediateTransaction, type Tx } from '$lib/server/db/tx';
import { recordEntry, type AuditDeps } from '$lib/server/features/audit';
import { getSetting, type AppsDeps } from '$lib/server/features/apps';
import type { Logger } from '$lib/server/logging/logger';
import { AppError } from '$lib/server/shared/errors';
import type { IdGenerator, IdKind } from '$lib/server/shared/ids';
import { toEpochMs, type EpochMs } from '$lib/shared/time';
import {
	applyCredit,
	applyExpiry,
	applyNegativeAdjustment,
	applyUsage,
	applyWelcome,
	balanceOf,
	canGrantWelcome,
	canReserve,
	type BucketKind,
	type LedgerState
} from './domain/ledger';
import { creditBuckets } from './schema';
import {
	accountHasWelcome,
	closeHold,
	expiredFreeBucketUsers,
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
	insertMovements
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
			readonly reason: 'debt_open' | 'insufficient_balance';
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
	| { readonly ok: true; readonly chargedMicro: number; readonly absorbedMicro: number }
	| { readonly ok: false; readonly reason: 'hold_not_open' };

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
			absorbedMicro: result.absorbed
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
	{ readonly ok: true } | { readonly ok: false; readonly reason: 'exceeds_available' };

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
	}
): AdjustOutcome {
	return immediateTransaction(deps.db, (tx) => {
		const now = deps.clock.now();
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
			recordEntry(
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
			return { ok: true };
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
		recordEntry(
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
		return { ok: true };
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
