// Tablas de la funcionalidad `credits` (data-model.md 2.6; T115): bolsas, saldo por usuario, reservas, ledger y la
// marca de bienvenida por email normalizado. `credits` es la única que escribe en ellas (principio IV). Las claves a
// `user`, `apps`, `payments` y `ai_operations` son `references()` de esquema (D-03).
import { sql } from 'drizzle-orm';
import { check, index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { bool, boolCheck, enumCheck, epochMs, micro, nowMs } from '$lib/server/db/columns';
import { toMicro } from '$lib/shared/money';
import { user } from '../accounts/schema';
import { apps } from '../apps/schema';
import { aiOperations } from '../ai/schema';
import { payments } from '../payments/schema';

export const BUCKET_KINDS = Object.freeze(['free', 'paid'] as const);
export const BUCKET_SOURCES = Object.freeze(['welcome', 'purchase', 'adjustment'] as const);
export const RELEASE_REASONS = Object.freeze([
	'consumed',
	'released',
	'expired',
	'interrupted'
] as const);
export const MOVEMENT_TYPES = Object.freeze([
	'welcome',
	'purchase',
	'usage',
	'adjustment',
	'expiry',
	'refund',
	'chargeback',
	'debt_settlement',
	'forfeit'
] as const);

/** Bolsas de saldo: cada compra, bienvenida o ajuste positivo crea una (BE-FR-12, 13). */
export const creditBuckets = sqliteTable(
	'credit_buckets',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'restrict' }),
		kind: text('kind', { enum: BUCKET_KINDS }).notNull(),
		source: text('source', { enum: BUCKET_SOURCES }).notNull(),
		initialMicro: micro('initial_micro').notNull(),
		remainingMicro: micro('remaining_micro').notNull(),
		expiresAt: epochMs('expires_at'),
		paymentId: text('payment_id').references(() => payments.id),
		simulated: bool('simulated').notNull().default(false),
		expiryWarningSentAt: epochMs('expiry_warning_sent_at'),
		createdAt: epochMs('created_at').notNull().default(nowMs)
	},
	(table) => [
		check('credit_buckets_initial_positive', sql`${sql.identifier('initial_micro')} > 0`),
		check(
			'credit_buckets_remaining_range',
			sql`${sql.identifier('remaining_micro')} BETWEEN 0 AND ${sql.identifier('initial_micro')}`
		),
		check('credit_buckets_kind_enum', enumCheck(table.kind.name, BUCKET_KINDS)),
		check('credit_buckets_source_enum', enumCheck(table.source.name, BUCKET_SOURCES)),
		check(
			'credit_buckets_free_has_expiry',
			sql`(${sql.identifier('kind')} = 'free') = (${sql.identifier('expires_at')} IS NOT NULL)`
		),
		check(
			'credit_buckets_welcome_is_free',
			sql`${sql.identifier('source')} <> 'welcome' OR ${sql.identifier('kind')} = 'free'`
		),
		check(
			'credit_buckets_purchase_has_payment',
			sql`(${sql.identifier('source')} = 'purchase') = (${sql.identifier('payment_id')} IS NOT NULL)`
		),
		check(
			'credit_buckets_purchase_is_paid',
			sql`${sql.identifier('source')} <> 'purchase' OR ${sql.identifier('kind')} = 'paid'`
		),
		check(
			'credit_buckets_simulated_only_purchase',
			sql`${sql.identifier('simulated')} = 0 OR ${sql.identifier('source')} = 'purchase'`
		),
		check('credit_buckets_simulated_bool', boolCheck(table.simulated.name)),
		uniqueIndex('credit_buckets_payment_unique')
			.on(table.paymentId)
			.where(sql`${sql.identifier('payment_id')} IS NOT NULL`),
		uniqueIndex('credit_buckets_welcome_unique')
			.on(table.userId)
			.where(sql`${sql.identifier('source')} = 'welcome'`),
		index('credit_buckets_user_idx')
			.on(table.userId, table.kind, table.expiresAt, table.createdAt)
			.where(sql`${sql.identifier('remaining_micro')} > 0`),
		index('credit_buckets_expiry_idx')
			.on(table.expiresAt)
			.where(sql`${sql.identifier('kind')} = 'free' AND ${sql.identifier('remaining_micro')} > 0`)
	]
);

/** Saldo materializado por usuario: deuda y marca de compra real (BE-FR-17, 49.7). El saldo total sale de sus bolsas. */
export const userBalances = sqliteTable(
	'user_balances',
	{
		userId: text('user_id')
			.primaryKey()
			.references(() => user.id, { onDelete: 'restrict' }),
		debtMicro: micro('debt_micro').notNull().default(toMicro(0)),
		hasRealPurchase: bool('has_real_purchase').notNull().default(false),
		lowBalanceThresholdMicro: micro('low_balance_threshold_micro'),
		lowBalanceNotified: bool('low_balance_notified').notNull().default(false),
		updatedAt: epochMs('updated_at').notNull().default(nowMs)
	},
	(table) => [
		check('user_balances_debt_non_negative', sql`${sql.identifier('debt_micro')} >= 0`),
		check(
			'user_balances_threshold_non_negative',
			sql`${sql.identifier('low_balance_threshold_micro')} IS NULL OR ${sql.identifier('low_balance_threshold_micro')} >= 0`
		),
		check('user_balances_real_purchase_bool', boolCheck(table.hasRealPurchase.name)),
		check('user_balances_notified_bool', boolCheck(table.lowBalanceNotified.name))
	]
);

/** Reservas de saldo mientras una operación está en curso (BE-FR-71). No son movimientos. */
export const creditHolds = sqliteTable(
	'credit_holds',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'restrict' }),
		appId: text('app_id')
			.notNull()
			.references(() => apps.id, { onDelete: 'restrict' }),
		operationId: text('operation_id')
			.notNull()
			.references(() => aiOperations.id, { onDelete: 'restrict' }),
		amountMicro: micro('amount_micro').notNull(),
		createdAt: epochMs('created_at').notNull().default(nowMs),
		expiresAt: epochMs('expires_at').notNull(),
		releasedAt: epochMs('released_at'),
		releaseReason: text('release_reason', { enum: RELEASE_REASONS })
	},
	(table) => [
		uniqueIndex('credit_holds_operation_unique').on(table.operationId),
		check('credit_holds_amount_positive', sql`${sql.identifier('amount_micro')} > 0`),
		check(
			'credit_holds_expiry_after_creation',
			sql`${sql.identifier('expires_at')} > ${sql.identifier('created_at')}`
		),
		check(
			'credit_holds_release_pair',
			sql`(${sql.identifier('released_at')} IS NULL) = (${sql.identifier('release_reason')} IS NULL)`
		),
		check('credit_holds_release_reason_enum', enumCheck(table.releaseReason.name, RELEASE_REASONS)),
		index('credit_holds_user_idx').on(table.userId),
		index('credit_holds_open_expiry_idx')
			.on(table.expiresAt)
			.where(sql`${sql.identifier('released_at')} IS NULL`)
	]
);

/** Ledger inmutable: todo cambio de saldo es un movimiento (BE-FR-15). Solo `INSERT`; los disparadores lo impiden. */
export const creditMovements = sqliteTable(
	'credit_movements',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'restrict' }),
		type: text('type', { enum: MOVEMENT_TYPES }).notNull(),
		amountMicro: micro('amount_micro').notNull(),
		bucketId: text('bucket_id').references(() => creditBuckets.id),
		operationId: text('operation_id').references(() => aiOperations.id),
		appId: text('app_id').references(() => apps.id),
		paymentId: text('payment_id').references(() => payments.id),
		adminId: text('admin_id').references(() => user.id),
		adminReason: text('admin_reason'),
		createdAt: epochMs('created_at').notNull().default(nowMs)
	},
	(table) => [
		check('credit_movements_amount_non_zero', sql`${sql.identifier('amount_micro')} <> 0`),
		check('credit_movements_type_enum', enumCheck(table.type.name, MOVEMENT_TYPES)),
		check(
			'credit_movements_welcome_sign',
			sql`${sql.identifier('type')} <> 'welcome' OR (${sql.identifier('amount_micro')} > 0 AND ${sql.identifier('bucket_id')} IS NOT NULL)`
		),
		check(
			'credit_movements_purchase_sign',
			sql`${sql.identifier('type')} <> 'purchase' OR (${sql.identifier('amount_micro')} > 0 AND ${sql.identifier('bucket_id')} IS NOT NULL AND ${sql.identifier('payment_id')} IS NOT NULL)`
		),
		check(
			'credit_movements_usage_sign',
			sql`${sql.identifier('type')} <> 'usage' OR (${sql.identifier('amount_micro')} < 0 AND ${sql.identifier('operation_id')} IS NOT NULL)`
		),
		check(
			'credit_movements_adjustment_admin',
			sql`${sql.identifier('type')} <> 'adjustment' OR (${sql.identifier('bucket_id')} IS NOT NULL AND ${sql.identifier('admin_reason')} IS NOT NULL AND ${sql.identifier('admin_id')} IS NOT NULL)`
		),
		check(
			'credit_movements_expiry_sign',
			sql`${sql.identifier('type')} <> 'expiry' OR (${sql.identifier('amount_micro')} < 0 AND ${sql.identifier('bucket_id')} IS NOT NULL)`
		),
		check(
			'credit_movements_refund_sign',
			sql`${sql.identifier('type')} <> 'refund' OR (${sql.identifier('amount_micro')} < 0 AND ${sql.identifier('bucket_id')} IS NOT NULL AND ${sql.identifier('payment_id')} IS NOT NULL AND ${sql.identifier('admin_reason')} IS NOT NULL)`
		),
		check(
			'credit_movements_chargeback_sign',
			sql`${sql.identifier('type')} <> 'chargeback' OR (${sql.identifier('amount_micro')} < 0 AND ${sql.identifier('payment_id')} IS NOT NULL)`
		),
		check(
			'credit_movements_settlement_shape',
			sql`${sql.identifier('type')} <> 'debt_settlement' OR (${sql.identifier('payment_id')} IS NOT NULL OR ${sql.identifier('admin_id')} IS NOT NULL)`
		),
		check(
			'credit_movements_forfeit_sign',
			sql`${sql.identifier('type')} <> 'forfeit' OR (${sql.identifier('amount_micro')} < 0 AND ${sql.identifier('bucket_id')} IS NOT NULL)`
		),
		index('credit_movements_user_idx').on(table.userId, table.createdAt),
		index('credit_movements_operation_idx').on(table.operationId),
		index('credit_movements_payment_idx').on(table.paymentId),
		index('credit_movements_bucket_idx').on(table.bucketId),
		index('credit_movements_type_idx').on(table.type, table.createdAt)
	]
);

/** Marca de la bienvenida por forma normalizada del email: HMAC-SHA256 con `EMAIL_HASH_KEY`, sin FK (BE-FR-11.5, D-20). */
export const welcomeGrants = sqliteTable('welcome_grants', {
	emailNormalizedHash: text('email_normalized_hash').primaryKey(),
	grantedAt: epochMs('granted_at').notNull().default(nowMs)
});
