// Tabla de la funcionalidad `ai` (data-model.md 2.12): registro de cada operación de IA, sin contenido. Solo se
// declara `ai_operations` (T074), la tabla que L05 necesita como destino de sus claves; `model_cache` llega después.
import { check, index, sqliteTable, text, uniqueIndex, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import {
	bool,
	boolCheck,
	enumCheck,
	epochMs,
	json,
	micro,
	microUsd,
	nowMs
} from '$lib/server/db/columns';
import { toMicro, toMicroUsd } from '$lib/shared/money';
import { user, session } from '../accounts/schema';
import { apps, appOperations, promptTemplates } from '../apps/schema';
import { fxRates } from '../pricing/schema';

export const AI_STATUSES = Object.freeze([
	'in_progress',
	'ok',
	'provider_error',
	'cancelled',
	'undelivered',
	'interrupted',
	'rejected'
] as const);
export const AI_PROVIDERS = Object.freeze(['mistral', 'openrouter'] as const);
export const ABSORBED_REASONS = Object.freeze(['undelivered_replay', 'debt_cap'] as const);

export const aiOperations = sqliteTable(
	'ai_operations',
	{
		id: text('id').primaryKey(),
		// Nulo solo tras la anonimización a los 24 meses.
		userId: text('user_id').references(() => user.id, { onDelete: 'restrict' }),
		appId: text('app_id')
			.notNull()
			.references(() => apps.id, { onDelete: 'restrict' }),
		sessionId: text('session_id').references(() => session.id, { onDelete: 'set null' }),
		appOperationId: text('app_operation_id')
			.notNull()
			.references(() => appOperations.id, { onDelete: 'restrict' }),
		promptTemplateId: text('prompt_template_id').references(() => promptTemplates.id, {
			onDelete: 'restrict'
		}),
		status: text('status', { enum: AI_STATUSES }).notNull().default('in_progress'),
		idempotencyKey: text('idempotency_key'),
		provider: text('provider', { enum: AI_PROVIDERS }),
		model: text('model'),
		usedFallback: bool('used_fallback').notNull().default(false),
		inputTokens: integer('input_tokens'),
		outputTokens: integer('output_tokens'),
		audioMs: integer('audio_ms'),
		costMicroUsd: microUsd('cost_micro_usd').notNull().default(toMicroUsd(0)),
		costEstimated: bool('cost_estimated').notNull().default(false),
		fxRateId: text('fx_rate_id').references(() => fxRates.id, { onDelete: 'restrict' }),
		holdMicro: micro('hold_micro'),
		chargedMicro: micro('charged_micro').notNull().default(toMicro(0)),
		absorbedMicro: micro('absorbed_micro').notNull().default(toMicro(0)),
		absorbedReason: text('absorbed_reason', { enum: ABSORBED_REASONS }),
		truncated: bool('truncated').notNull().default(false),
		flagged: bool('flagged').notNull().default(false),
		durationMs: integer('duration_ms'),
		appVersion: text('app_version'),
		errorCode: text('error_code'),
		providerGenerationId: text('provider_generation_id'),
		createdAt: epochMs('created_at').notNull().default(nowMs),
		completedAt: epochMs('completed_at')
	},
	(table) => [
		// Idempotencia (D-12): nunca dos ejecuciones en curso con la misma clave. No es total: una repetición tras
		// `undelivered`, fallo o cancelación crea otra fila con la misma clave.
		uniqueIndex('ai_operations_inflight_idempotency_unique')
			.on(table.userId, table.idempotencyKey)
			.where(
				sql`${sql.identifier('idempotency_key')} IS NOT NULL AND ${sql.identifier('status')} = 'in_progress'`
			),
		index('ai_operations_idempotency_window_idx')
			.on(table.userId, table.idempotencyKey, table.createdAt)
			.where(sql`${sql.identifier('idempotency_key')} IS NOT NULL`),
		index('ai_operations_user_created_idx').on(table.userId, table.createdAt),
		index('ai_operations_app_created_idx').on(table.appId, table.createdAt),
		index('ai_operations_created_idx').on(table.createdAt),
		index('ai_operations_in_progress_idx')
			.on(table.status)
			.where(sql`${sql.identifier('status')} = 'in_progress'`),
		index('ai_operations_flagged_idx')
			.on(table.userId, table.createdAt)
			.where(sql`${sql.identifier('flagged')} = 1`),
		check('ai_operations_status_enum', enumCheck(table.status.name, AI_STATUSES)),
		check('ai_operations_provider_enum', enumCheck(table.provider.name, AI_PROVIDERS)),
		check(
			'ai_operations_absorbed_reason_enum',
			enumCheck(table.absorbedReason.name, ABSORBED_REASONS)
		),
		check('ai_operations_charged_non_negative', sql`${sql.identifier('charged_micro')} >= 0`),
		check('ai_operations_absorbed_non_negative', sql`${sql.identifier('absorbed_micro')} >= 0`),
		check(
			'ai_operations_hold_positive',
			sql`${sql.identifier('hold_micro')} IS NULL OR ${sql.identifier('hold_micro')} > 0`
		),
		check(
			'ai_operations_absorbed_reason_matches_amount',
			sql`(${sql.identifier('absorbed_micro')} = 0) = (${sql.identifier('absorbed_reason')} IS NULL)`
		),
		check(
			'ai_operations_unbilled_statuses',
			sql`${sql.identifier('status')} NOT IN ('in_progress', 'rejected', 'interrupted', 'cancelled', 'provider_error') OR ${sql.identifier('charged_micro')} = 0`
		),
		check(
			'ai_operations_rejected_has_no_hold_or_provider',
			sql`${sql.identifier('status')} <> 'rejected' OR (${sql.identifier('hold_micro')} IS NULL AND ${sql.identifier('provider')} IS NULL)`
		),
		check(
			'ai_operations_in_progress_has_no_completion',
			sql`(${sql.identifier('status')} = 'in_progress') = (${sql.identifier('completed_at')} IS NULL)`
		),
		check('ai_operations_used_fallback_bool', boolCheck(table.usedFallback.name)),
		check('ai_operations_cost_estimated_bool', boolCheck(table.costEstimated.name)),
		check('ai_operations_truncated_bool', boolCheck(table.truncated.name)),
		check('ai_operations_flagged_bool', boolCheck(table.flagged.name))
	]
);

/** Caché del catálogo de modelos del proveedor (BE-FR-80, BE-FR-81; data-model 2.12; T155). Solo lectura para la estimación. */
export interface ModelPricingJson {
	readonly inputPerMTokMicroUsd: number;
	readonly outputPerMTokMicroUsd: number;
}

export const modelCache = sqliteTable('model_cache', {
	modelId: text('model_id').primaryKey(),
	pricing: json<ModelPricingJson>('pricing').notNull(),
	modalities: json<readonly string[]>('modalities').notNull(),
	supportedParameters: json<readonly string[]>('supported_parameters').notNull(),
	fetchedAt: epochMs('fetched_at').notNull()
});
