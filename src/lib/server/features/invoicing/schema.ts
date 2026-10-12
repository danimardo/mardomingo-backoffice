// Perfil de facturación y facturas (BE-FR-74, BE-FR-75, BE-FR-27, BE-FR-28; data-model 2.7; T224). `invoices` es inmutable:
// los triggers de la migración personalizada (`0011_invoices_immutable.sql`) impiden UPDATE y DELETE (T225).
import { sql } from 'drizzle-orm';
import {
	check,
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
	type AnySQLiteColumn
} from 'drizzle-orm/sqlite-core';
import { enumCheck, epochMs, json, nowMs } from '$lib/server/db/columns';
import { user } from '$lib/server/features/accounts/schema';
import { payments } from '$lib/server/features/payments/schema';

export const BILLING_KINDS = Object.freeze(['individual', 'business'] as const);
export const INVOICE_KINDS = Object.freeze(['simplified', 'full', 'corrective'] as const);

export const billingProfiles = sqliteTable(
	'billing_profiles',
	{
		userId: text('user_id')
			.primaryKey()
			.references(() => user.id, { onDelete: 'restrict' }),
		kind: text('kind', { enum: BILLING_KINDS }).notNull(),
		legalName: text('legal_name').notNull(),
		taxId: text('tax_id').notNull(),
		address: text('address').notNull(),
		postalCode: text('postal_code').notNull(),
		city: text('city').notNull(),
		country: text('country').notNull(),
		createdAt: epochMs('created_at').notNull().default(nowMs),
		updatedAt: epochMs('updated_at').notNull().default(nowMs)
	},
	(table) => [
		check('billing_profiles_kind_enum', enumCheck(table.kind.name, BILLING_KINDS)),
		check('billing_profiles_country_length', sql`length(${sql.identifier('country')}) = 2`)
	]
);

export const invoices = sqliteTable(
	'invoices',
	{
		id: text('id').primaryKey(),
		paymentId: text('payment_id')
			.notNull()
			.references(() => payments.id),
		kind: text('kind', { enum: INVOICE_KINDS }).notNull(),
		series: text('series').notNull(),
		number: text('number').notNull(),
		billingSnapshot: json<Readonly<Record<string, unknown>>>('billing_snapshot'),
		amountEurCents: integer('amount_eur_cents').notNull(),
		correctsInvoiceId: text('corrects_invoice_id').references((): AnySQLiteColumn => invoices.id),
		issueKey: text('issue_key').notNull(),
		provider: text('provider').notNull(),
		providerRef: text('provider_ref'),
		pdfRef: text('pdf_ref'),
		issuedAt: epochMs('issued_at').notNull()
	},
	(table) => [
		uniqueIndex('invoices_series_number_uq').on(table.series, table.number),
		uniqueIndex('invoices_issue_key_uq').on(table.issueKey),
		index('invoices_payment_idx').on(table.paymentId),
		check('invoices_kind_enum', enumCheck(table.kind.name, INVOICE_KINDS)),
		check(
			'invoices_corrective_has_target',
			sql`(${sql.identifier('kind')} = 'corrective') = (${sql.identifier('corrects_invoice_id')} IS NOT NULL)`
		),
		check(
			'invoices_corrective_negative',
			sql`(${sql.identifier('kind')} = 'corrective') = (${sql.identifier('amount_eur_cents')} < 0)`
		),
		check(
			'invoices_full_has_snapshot',
			sql`${sql.identifier('kind')} <> 'full' OR ${sql.identifier('billing_snapshot')} IS NOT NULL`
		)
	]
);
