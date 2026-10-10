// Tablas de la funcionalidad `pricing` (data-model.md 2.5): tipos de cambio USD→EUR. Histórico de solo inserción:
// la vigencia es la fila con mayor `effective_from` ≤ ahora. La clave a `user` es `references()` (D-03).
import { check, index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { civilDate, civilDateCheck, enumCheck, epochMs, nowMs, ppm } from '$lib/server/db/columns';
import { user } from '../accounts/schema';

export const FX_SOURCES = Object.freeze(['ecb', 'manual'] as const);

export const fxRates = sqliteTable(
	'fx_rates',
	{
		id: text('id').primaryKey(),
		usdEurPpm: ppm('usd_eur_ppm').notNull(),
		source: text('source', { enum: FX_SOURCES }).notNull(),
		ecbRatePpm: ppm('ecb_rate_ppm'),
		ecbDate: civilDate('ecb_date'),
		bufferPpm: ppm('buffer_ppm'),
		effectiveFrom: epochMs('effective_from').notNull(),
		createdBy: text('created_by').references(() => user.id, { onDelete: 'restrict' }),
		createdAt: epochMs('created_at').notNull().default(nowMs)
	},
	(table) => [
		index('fx_rates_effective_idx').on(table.effectiveFrom),
		check('fx_rates_usd_eur_positive', sql`${sql.identifier('usd_eur_ppm')} > 0`),
		check('fx_rates_source_enum', enumCheck(table.source.name, FX_SOURCES)),
		check(
			'fx_rates_ecb_fields',
			sql`${sql.identifier('source')} = 'manual' OR (${sql.identifier('ecb_rate_ppm')} > 0 AND ${sql.identifier('ecb_date')} IS NOT NULL AND ${sql.identifier('buffer_ppm')} IS NOT NULL)`
		),
		check(
			'fx_rates_ecb_date_format',
			sql`${sql.identifier('ecb_date')} IS NULL OR ${civilDateCheck('ecb_date')}`
		),
		check(
			'fx_rates_manual_has_author',
			sql`${sql.identifier('source')} = 'ecb' OR ${sql.identifier('created_by')} IS NOT NULL`
		)
	]
);
