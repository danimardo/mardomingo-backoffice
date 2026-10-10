// Tablas de la funcionalidad `payments` (data-model.md 2.9): paquetes de créditos y compras. Las claves a `user`,
// `terms_acceptances` y `packs` son `references()`. El repositorio y el servicio llegan en L10 (T073).
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import {
	bool,
	boolCheck,
	enumCheck,
	epochMs,
	eurCents,
	micro,
	nowMs,
	ppm
} from '$lib/server/db/columns';
import { toEurCents, toPpm } from '$lib/shared/money';
import { user } from '../accounts/schema';
import { termsAcceptances } from '../legal/schema';

export const PAYMENT_PROVIDERS = Object.freeze(['simulated', 'stripe'] as const);
export const PAYMENT_STATUSES = Object.freeze([
	'pending',
	'completed',
	'refunded',
	'partially_refunded',
	'chargeback'
] as const);

export const packs = sqliteTable(
	'packs',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		// IVA incluido.
		priceEurCents: eurCents('price_eur_cents').notNull(),
		bonusPpm: ppm('bonus_ppm').notNull().default(toPpm(0)),
		active: bool('active').notNull().default(true),
		sortOrder: integer('sort_order').notNull().default(0),
		createdAt: epochMs('created_at').notNull().default(nowMs),
		updatedAt: epochMs('updated_at').notNull().default(nowMs)
	},
	(table) => [
		index('packs_active_order_idx').on(table.active, table.sortOrder),
		check('packs_price_positive', sql`${sql.identifier('price_eur_cents')} > 0`),
		check('packs_bonus_non_negative', sql`${sql.identifier('bonus_ppm')} >= 0`),
		check('packs_active_bool', boolCheck(table.active.name))
	]
);

export const payments = sqliteTable(
	'payments',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'restrict' }),
		packId: text('pack_id')
			.notNull()
			.references(() => packs.id, { onDelete: 'restrict' }),
		// Identificador de intento de un solo uso generado por la página de compra (BE-FR-25 CA4).
		attemptId: text('attempt_id').notNull(),
		provider: text('provider', { enum: PAYMENT_PROVIDERS }).notNull(),
		providerRef: text('provider_ref').notNull().unique(),
		status: text('status', { enum: PAYMENT_STATUSES }).notNull().default('pending'),
		amountEurCents: eurCents('amount_eur_cents').notNull(),
		baseEurCents: eurCents('base_eur_cents').notNull(),
		vatEurCents: eurCents('vat_eur_cents').notNull(),
		vatRatePpm: ppm('vat_rate_ppm').notNull(),
		country: text('country').notNull(),
		creditsMicro: micro('credits_micro').notNull(),
		wantsFullInvoice: bool('wants_full_invoice').notNull().default(false),
		simulated: bool('simulated').notNull(),
		withdrawalAcceptanceId: text('withdrawal_acceptance_id')
			.notNull()
			.references(() => termsAcceptances.id, { onDelete: 'restrict' }),
		refundedEurCents: eurCents('refunded_eur_cents').notNull().default(toEurCents(0)),
		createdAt: epochMs('created_at').notNull().default(nowMs),
		completedAt: epochMs('completed_at'),
		updatedAt: epochMs('updated_at').notNull().default(nowMs)
	},
	(table) => [
		uniqueIndex('payments_user_attempt_unique').on(table.userId, table.attemptId),
		index('payments_user_created_idx').on(table.userId, table.createdAt),
		index('payments_status_completed_idx').on(table.status, table.completedAt),
		check('payments_provider_enum', enumCheck(table.provider.name, PAYMENT_PROVIDERS)),
		check('payments_status_enum', enumCheck(table.status.name, PAYMENT_STATUSES)),
		check('payments_amount_positive', sql`${sql.identifier('amount_eur_cents')} > 0`),
		check('payments_credits_positive', sql`${sql.identifier('credits_micro')} > 0`),
		check(
			'payments_simulated_matches_provider',
			sql`(${sql.identifier('provider')} = 'simulated') = (${sql.identifier('simulated')} = 1)`
		),
		check(
			'payments_pending_has_no_completion',
			sql`(${sql.identifier('status')} = 'pending') = (${sql.identifier('completed_at')} IS NULL)`
		),
		check(
			'payments_refund_range',
			sql`${sql.identifier('refunded_eur_cents')} BETWEEN 0 AND ${sql.identifier('amount_eur_cents')}`
		),
		check(
			'payments_vat_adds_up',
			sql`${sql.identifier('base_eur_cents')} + ${sql.identifier('vat_eur_cents')} = ${sql.identifier('amount_eur_cents')}`
		),
		check('payments_country_iso2', sql`length(${sql.identifier('country')}) = 2`),
		check('payments_wants_invoice_bool', boolCheck(table.wantsFullInvoice.name)),
		check('payments_simulated_bool', boolCheck(table.simulated.name))
	]
);
