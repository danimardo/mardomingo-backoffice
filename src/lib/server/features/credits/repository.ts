// Acceso a las tablas de `credits` (T123). Solo lee y escribe filas; ninguna regla vive aquí (eso es `domain/ledger.ts`).
// Las escrituras reciben el `Tx` de la transacción `BEGIN IMMEDIATE` que abre el servicio.
import { and, eq, gt, gte, inArray, isNull, lt, lte, sql } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import type { Tx } from '$lib/server/db/tx';
import { toMicro } from '$lib/shared/money';
import { toEpochMs, type EpochMs } from '$lib/shared/time';
import type {
	Bucket,
	BucketKind,
	BucketSource,
	Line,
	LineType,
	LedgerState
} from './domain/ledger';
import { creditBuckets, creditHolds, creditMovements, userBalances, welcomeGrants } from './schema';

export type ReleaseReason = 'consumed' | 'released' | 'expired' | 'interrupted';

export interface OpenHold {
	readonly id: string;
	readonly userId: string;
	readonly appId: string;
	readonly operationId: string;
	readonly amountMicro: number;
	readonly expiresAt: number;
}

/** Estado de una cuenta en el dominio: bolsas con saldo y deuda (lo que el servicio carga antes de cada transición). */
export function loadState(db: Db | Tx, userId: string): LedgerState {
	const rows = db
		.select()
		.from(creditBuckets)
		.where(and(eq(creditBuckets.userId, userId), gt(creditBuckets.remainingMicro, toMicro(0))))
		.all();
	return { buckets: rows.map(toDomainBucket), debt: debtOf(db, userId) };
}

function toDomainBucket(row: typeof creditBuckets.$inferSelect): Bucket {
	return {
		id: row.id,
		kind: row.kind,
		source: row.source,
		initial: row.initialMicro,
		remaining: row.remainingMicro,
		expiresAt: row.expiresAt,
		createdAt: row.createdAt,
		paymentId: row.paymentId,
		simulated: row.simulated
	};
}

export function debtOf(db: Db | Tx, userId: string): number {
	const row = db
		.select({ debt: userBalances.debtMicro })
		.from(userBalances)
		.where(eq(userBalances.userId, userId))
		.get();
	return row?.debt ?? 0;
}

/** ¿Existe ya una bolsa de bienvenida de esta cuenta, con saldo o gastada? (D10: una por cuenta.) */
export function accountHasWelcome(db: Db | Tx, userId: string): boolean {
	return (
		db
			.select({ id: creditBuckets.id })
			.from(creditBuckets)
			.where(and(eq(creditBuckets.userId, userId), eq(creditBuckets.source, 'welcome')))
			.get() !== undefined
	);
}

export function hasWelcomeGrant(db: Db | Tx, hash: string): boolean {
	return (
		db
			.select({ hash: welcomeGrants.emailNormalizedHash })
			.from(welcomeGrants)
			.where(eq(welcomeGrants.emailNormalizedHash, hash))
			.get() !== undefined
	);
}

export function insertWelcomeGrant(tx: Tx, hash: string, now: EpochMs): void {
	tx.insert(welcomeGrants).values({ emailNormalizedHash: hash, grantedAt: now }).run();
}

export function insertBucket(
	tx: Tx,
	row: {
		readonly id: string;
		readonly userId: string;
		readonly kind: BucketKind;
		readonly source: BucketSource;
		readonly initial: number;
		readonly remaining: number;
		readonly expiresAt: number | null;
		readonly createdAt: number;
		readonly paymentId?: string | null;
		readonly simulated?: boolean;
	}
): void {
	tx.insert(creditBuckets)
		.values({
			id: row.id,
			userId: row.userId,
			kind: row.kind,
			source: row.source,
			initialMicro: toMicro(row.initial),
			remainingMicro: toMicro(row.remaining),
			expiresAt: row.expiresAt === null ? null : toEpochMs(row.expiresAt),
			createdAt: toEpochMs(row.createdAt),
			paymentId: row.paymentId ?? null,
			simulated: row.simulated ?? false
		})
		.run();
}

export function setBucketRemaining(tx: Tx, id: string, remaining: number): void {
	tx.update(creditBuckets)
		.set({ remainingMicro: toMicro(remaining) })
		.where(eq(creditBuckets.id, id))
		.run();
}

/** Bolsa de la compra `paymentId`, con su importe inicial y su saldo (BE-FR-27, BE-FR-28). */
export function bucketOfPayment(
	db: Db | Tx,
	paymentId: string
): { readonly id: string; readonly initial: number; readonly remaining: number } | undefined {
	return db
		.select({
			id: creditBuckets.id,
			initial: creditBuckets.initialMicro,
			remaining: creditBuckets.remainingMicro
		})
		.from(creditBuckets)
		.where(eq(creditBuckets.paymentId, paymentId))
		.get();
}

/** Micro-créditos ya retirados de la compra por reembolsos (positivo). */
export function refundedMicroOf(db: Db | Tx, paymentId: string): number {
	const row = db
		.select({ total: sql<number>`coalesce(sum(${creditMovements.amountMicro}), 0)` })
		.from(creditMovements)
		.where(and(eq(creditMovements.paymentId, paymentId), eq(creditMovements.type, 'refund')))
		.get();
	return -(row?.total ?? 0);
}

/** ¿Hay ya un movimiento de este tipo para la compra? Evita repetir el contracargo. */
export function movementExistsForPayment(db: Db | Tx, paymentId: string, type: LineType): boolean {
	return (
		db
			.select({ id: creditMovements.id })
			.from(creditMovements)
			.where(and(eq(creditMovements.paymentId, paymentId), eq(creditMovements.type, type)))
			.get() !== undefined
	);
}

/** Umbral de saldo bajo de la cuenta (nulo = aviso desactivado) y si ya se avisó (BE-FR-49.7). */
export function lowBalanceStateOf(
	db: Db | Tx,
	userId: string
): { readonly thresholdMicro: number | null; readonly notified: boolean } {
	const row = db
		.select({
			threshold: userBalances.lowBalanceThresholdMicro,
			notified: userBalances.lowBalanceNotified
		})
		.from(userBalances)
		.where(eq(userBalances.userId, userId))
		.get();
	return { thresholdMicro: row?.threshold ?? null, notified: row?.notified ?? false };
}

export function setLowBalanceNotified(
	tx: Tx,
	userId: string,
	notified: boolean,
	now: EpochMs
): void {
	tx.update(userBalances)
		.set({ lowBalanceNotified: notified, updatedAt: now })
		.where(eq(userBalances.userId, userId))
		.run();
}

/** Marca la cuenta con compra real, sin tocar su deuda ni sus bolsas (BE-FR-11 CA2). */
export function setRealPurchase(tx: Tx, userId: string, now: EpochMs): void {
	tx.insert(userBalances)
		.values({ userId, hasRealPurchase: true, updatedAt: now })
		.onConflictDoUpdate({
			target: userBalances.userId,
			set: { hasRealPurchase: true, updatedAt: now }
		})
		.run();
}

/** Deja la deuda de la cuenta en `debt` y crea su fila de saldo si no existe (BE-FR-17). */
export function setDebt(tx: Tx, userId: string, debt: number, now: EpochMs): void {
	tx.insert(userBalances)
		.values({ userId, debtMicro: toMicro(debt), updatedAt: now })
		.onConflictDoUpdate({
			target: userBalances.userId,
			set: { debtMicro: toMicro(debt), updatedAt: now }
		})
		.run();
}

export interface MovementRow {
	readonly userId: string;
	readonly type: LineType;
	readonly amount: number;
	readonly bucketId: string | null;
	readonly operationId?: string | null;
	readonly appId?: string | null;
	readonly paymentId?: string | null;
	readonly adminId?: string | null;
	readonly adminReason?: string | null;
}

/** Escribe las líneas de una transición como movimientos (BE-FR-15); el ledger solo admite inserciones. */
export function insertMovements(
	tx: Tx,
	rows: readonly MovementRow[],
	ids: () => string,
	now: EpochMs
): void {
	for (const row of rows) {
		tx.insert(creditMovements)
			.values({
				id: ids(),
				userId: row.userId,
				type: row.type,
				amountMicro: toMicro(row.amount),
				bucketId: row.bucketId,
				operationId: row.operationId ?? null,
				appId: row.appId ?? null,
				paymentId: row.paymentId ?? null,
				adminId: row.adminId ?? null,
				adminReason: row.adminReason ?? null,
				createdAt: now
			})
			.run();
	}
}

/** Movimientos de una transición: cada línea con las referencias que el servicio le añade. */
export function movementRows(
	userId: string,
	lines: readonly Line[],
	extra: Omit<MovementRow, 'userId' | 'type' | 'amount' | 'bucketId'> = {}
): MovementRow[] {
	return lines.map((line) => ({
		userId,
		type: line.type,
		amount: line.amount,
		bucketId: line.bucketId,
		...extra
	}));
}

/** Persiste el paso de un estado a otro: saldos de las bolsas que cambian, bolsas nuevas y deuda. */
export function persistState(
	tx: Tx,
	userId: string,
	before: LedgerState,
	after: LedgerState,
	now: EpochMs
): void {
	const previous = new Map(before.buckets.map((item) => [item.id, item]));
	for (const item of after.buckets) {
		const old = previous.get(item.id);
		if (old === undefined) {
			insertBucket(tx, { ...item, userId });
		} else if (old.remaining !== item.remaining) {
			setBucketRemaining(tx, item.id, item.remaining);
		}
	}
	// Siempre: la fila de saldo de la cuenta existe desde su primera transición, aunque la deuda sea cero.
	setDebt(tx, userId, after.debt, now);
}

// ---------------------------------------------------------------------------------------------------------------------
// Reservas

export function insertHold(
	tx: Tx,
	row: {
		readonly id: string;
		readonly userId: string;
		readonly appId: string;
		readonly operationId: string;
		readonly amountMicro: number;
		readonly createdAt: number;
		readonly expiresAt: number;
	}
): void {
	tx.insert(creditHolds)
		.values({
			id: row.id,
			userId: row.userId,
			appId: row.appId,
			operationId: row.operationId,
			amountMicro: toMicro(row.amountMicro),
			createdAt: toEpochMs(row.createdAt),
			expiresAt: toEpochMs(row.expiresAt)
		})
		.run();
}

export function openHoldOf(db: Db | Tx, id: string): OpenHold | undefined {
	const row = db
		.select()
		.from(creditHolds)
		.where(and(eq(creditHolds.id, id), isNull(creditHolds.releasedAt)))
		.get();
	return row === undefined ? undefined : toOpenHold(row);
}

function toOpenHold(row: typeof creditHolds.$inferSelect): OpenHold {
	return {
		id: row.id,
		userId: row.userId,
		appId: row.appId,
		operationId: row.operationId,
		amountMicro: row.amountMicro,
		expiresAt: row.expiresAt
	};
}

export function openHolds(
	db: Db | Tx,
	filter: { readonly userId?: string; readonly expiredBefore?: number } = {}
): OpenHold[] {
	const conditions = [isNull(creditHolds.releasedAt)];
	if (filter.userId !== undefined) conditions.push(eq(creditHolds.userId, filter.userId));
	if (filter.expiredBefore !== undefined)
		conditions.push(lt(creditHolds.expiresAt, toEpochMs(filter.expiredBefore)));
	return db
		.select()
		.from(creditHolds)
		.where(and(...conditions))
		.all()
		.map(toOpenHold);
}

/** Suma de las reservas abiertas de una cuenta (D5). */
export function reservedOf(db: Db | Tx, userId: string): number {
	return openHolds(db, { userId }).reduce((sum, hold) => sum + hold.amountMicro, 0);
}

/** Cobros de uso desde `sinceMs` en todas las apps. Los movimientos de uso son negativos; aquí se devuelven en positivo. */
export function usageSince(db: Db | Tx, userId: string, sinceMs: EpochMs): number {
	const row = db
		.select({ total: sql<number>`coalesce(sum(${creditMovements.amountMicro}), 0)` })
		.from(creditMovements)
		.where(
			and(
				eq(creditMovements.userId, userId),
				eq(creditMovements.type, 'usage'),
				gte(creditMovements.createdAt, sinceMs)
			)
		)
		.get();
	return -(row?.total ?? 0);
}

/** Cuentas de la lista que tienen compra real (BE-FR-11 CA2). Las demás son cuentas sin compras reales. */
export function realPurchaseUserIds(db: Db | Tx, userIds: readonly string[]): Set<string> {
	if (userIds.length === 0) return new Set();
	const rows = db
		.select({ userId: userBalances.userId })
		.from(userBalances)
		.where(and(inArray(userBalances.userId, [...userIds]), eq(userBalances.hasRealPurchase, true)))
		.all();
	return new Set(rows.map((row) => row.userId));
}

/** Micro-créditos reservados en curso de las cuentas sin compra real (BE-FR-46 CA1). */
export function freeAccountsOpenHoldsMicro(db: Db | Tx): number {
	const holds = openHolds(db);
	const paying = realPurchaseUserIds(db, [...new Set(holds.map((hold) => hold.userId))]);
	return holds
		.filter((hold) => !paying.has(hold.userId))
		.reduce((sum, hold) => sum + hold.amountMicro, 0);
}

/** Si la cuenta tiene una compra real (BE-FR-11 CA2). Sin fila de saldo, no la tiene. */
export function hasRealPurchaseOf(db: Db | Tx, userId: string): boolean {
	const row = db
		.select({ flag: userBalances.hasRealPurchase })
		.from(userBalances)
		.where(eq(userBalances.userId, userId))
		.get();
	return row?.flag === true;
}

export function closeHold(tx: Tx, id: string, reason: ReleaseReason, now: EpochMs): void {
	tx.update(creditHolds)
		.set({ releasedAt: now, releaseReason: reason })
		.where(and(eq(creditHolds.id, id), isNull(creditHolds.releasedAt)))
		.run();
}

/** Bolsas gratuitas caducadas con saldo, de cualquier cuenta (BE-FR-16). */
export function expiredFreeBucketUsers(db: Db | Tx, now: number): string[] {
	const rows = db
		.selectDistinct({ userId: creditBuckets.userId })
		.from(creditBuckets)
		.where(
			and(
				eq(creditBuckets.kind, 'free'),
				gt(creditBuckets.remainingMicro, toMicro(0)),
				lte(creditBuckets.expiresAt, toEpochMs(now))
			)
		)
		.all();
	return rows.map((row) => row.userId);
}

/** Próxima caducidad de una bolsa gratuita con saldo, o `null`. */
export function nextFreeExpiry(db: Db | Tx, userId: string): number | null {
	const row = db
		.select({ at: sql<number | null>`min(${creditBuckets.expiresAt})` })
		.from(creditBuckets)
		.where(
			and(
				eq(creditBuckets.userId, userId),
				eq(creditBuckets.kind, 'free'),
				gt(creditBuckets.remainingMicro, toMicro(0))
			)
		)
		.get();
	return row?.at ?? null;
}
