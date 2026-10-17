// Tablas de la funcionalidad `pricing` (data-model.md 2.5): tipos de cambio USD→EUR. Histórico de solo inserción:
// la vigencia es la fila con mayor `effective_from` ≤ ahora. La clave a `user` es `references()` (D-03).
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import {
	civilDate,
	civilDateCheck,
	enumCheck,
	epochMs,
	micro,
	nowMs,
	ppm
} from '$lib/server/db/columns';
import { appOperations } from '../apps/schema';
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

// Valor orientativo del coste típico de cada operación (BE-FR-73; data-model 2.5; T298). Lo calcula la tarea diaria a partir de
// las muestras reales; el administrador puede fijar un valor manual que sobrevive a los recálculos.
export const PRICE_SOURCES = Object.freeze(['auto', 'manual'] as const);

export const priceReferences = sqliteTable(
	'price_references',
	{
		operationId: text('operation_id')
			.primaryKey()
			.references(() => appOperations.id, { onDelete: 'restrict' }),
		typicalMicro: micro('typical_micro'),
		source: text('source', { enum: PRICE_SOURCES }),
		sampleSize: integer('sample_size').notNull().default(0),
		manualTypicalMicro: micro('manual_typical_micro'),
		computedAt: epochMs('computed_at')
	},
	(table) => [
		check(
			'price_references_source_pair',
			sql`(${sql.identifier('typical_micro')} IS NULL) = (${sql.identifier('source')} IS NULL)`
		),
		check('price_references_source_enum', enumCheck(table.source.name, PRICE_SOURCES)),
		check(
			'price_references_typical_non_negative',
			sql`${sql.identifier('typical_micro')} IS NULL OR ${sql.identifier('typical_micro')} >= 0`
		),
		check(
			'price_references_manual_non_negative',
			sql`${sql.identifier('manual_typical_micro')} IS NULL OR ${sql.identifier('manual_typical_micro')} >= 0`
		),
		check('price_references_sample_non_negative', sql`${sql.identifier('sample_size')} >= 0`)
	]
);
