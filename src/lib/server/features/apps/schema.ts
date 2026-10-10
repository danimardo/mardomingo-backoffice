// Tablas de la funcionalidad `apps` (data-model.md 2.3): registro de apps, catálogo de operaciones, plantillas
// inmutables por versión y parámetros globales. Las claves a `user` (creador de plantillas) son `references()` (D-03).
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import {
	bool,
	boolCheck,
	enumCheck,
	epochMs,
	json,
	jsonCheck,
	micro,
	microUsd,
	nowMs,
	ppm
} from '$lib/server/db/columns';
import { user } from '../accounts/schema';
import type {
	AllowedOrigins,
	AppLinks,
	Capabilities,
	ClientTypes,
	FallbackModels,
	OperationLimits,
	ResponseFormat,
	SettingsOverrides,
	SettingValue,
	SyncSchema,
	TemplateMessages,
	TemplateTools,
	TemplateVariables,
	TranscriptionConfig
} from './json-schemas';

export const APP_STATUSES = Object.freeze(['active', 'disabled'] as const);
export const OPERATION_KINDS = Object.freeze(['chat', 'transcription', 'image'] as const);
export const OPERATION_MODES = Object.freeze(['libre', 'plantilla'] as const);

export const apps = sqliteTable(
	'apps',
	{
		id: text('id').primaryKey(),
		slug: text('slug').notNull().unique(),
		name: text('name').notNull(),
		description: text('description').notNull().default(''),
		clientTypes: json<ClientTypes>('client_types').notNull(),
		status: text('status', { enum: APP_STATUSES }).notNull().default('active'),
		links: json<AppLinks>('links').notNull(),
		minAppVersion: text('min_app_version'),
		recommendedAppVersion: text('recommended_app_version'),
		enforceVersion: bool('enforce_version').notNull().default(false),
		maintenanceActive: bool('maintenance_active').notNull().default(false),
		maintenanceMessage: text('maintenance_message').notNull().default(''),
		allowedOrigins: json<AllowedOrigins>('allowed_origins')
			.notNull()
			.default(sql`'[]'`),
		postVerifyText: text('post_verify_text'),
		settingsOverrides: json<SettingsOverrides>('settings_overrides')
			.notNull()
			.default(sql`'{}'`),
		syncSchema: json<SyncSchema>('sync_schema').notNull(),
		supportEmail: text('support_email'),
		createdAt: epochMs('created_at').notNull().default(nowMs),
		updatedAt: epochMs('updated_at').notNull().default(nowMs)
	},
	(table) => [
		check(
			'apps_slug_format',
			sql`${sql.identifier('slug')} GLOB '[a-z]*' AND ${sql.identifier('slug')} NOT GLOB '*[^a-z0-9-]*'`
		),
		check('apps_status_enum', enumCheck(table.status.name, APP_STATUSES)),
		check('apps_enforce_version_bool', boolCheck(table.enforceVersion.name)),
		check('apps_maintenance_bool', boolCheck(table.maintenanceActive.name)),
		check(
			'apps_enforce_version_needs_min',
			sql`${sql.identifier('enforce_version')} = 0 OR ${sql.identifier('min_app_version')} IS NOT NULL`
		),
		check('apps_client_types_json', jsonCheck(table.clientTypes.name)),
		check('apps_links_json', jsonCheck(table.links.name)),
		check('apps_allowed_origins_json', jsonCheck(table.allowedOrigins.name)),
		check('apps_settings_overrides_json', jsonCheck(table.settingsOverrides.name)),
		check('apps_sync_schema_json', jsonCheck(table.syncSchema.name))
	]
);

export const appOperations = sqliteTable(
	'app_operations',
	{
		id: text('id').primaryKey(),
		appId: text('app_id')
			.notNull()
			.references(() => apps.id, { onDelete: 'restrict' }),
		key: text('key').notNull(),
		name: text('name').notNull(),
		kind: text('kind', { enum: OPERATION_KINDS }).notNull(),
		mode: text('mode', { enum: OPERATION_MODES }).notNull().default('libre'),
		model: text('model'),
		fallbackModels: json<FallbackModels>('fallback_models')
			.notNull()
			.default(sql`'[]'`),
		preferredProvider: text('preferred_provider'),
		marginOverridePpm: ppm('margin_override_ppm'),
		temperatureMilli: integer('temperature_milli').notNull().default(700),
		maxOutputTokens: integer('max_output_tokens'),
		maxCostMicro: micro('max_cost_micro').notNull(),
		estimatedMaxCostMicroUsd: microUsd('estimated_max_cost_micro_usd'),
		timeoutMs: integer('timeout_ms').notNull(),
		capabilities: json<Capabilities>('capabilities').notNull(),
		limits: json<OperationLimits>('limits')
			.notNull()
			.default(sql`'{}'`),
		transcriptionConfig: json<TranscriptionConfig>('transcription_config'),
		groupLabel: text('group_label'),
		active: bool('active').notNull().default(false),
		createdAt: epochMs('created_at').notNull().default(nowMs),
		updatedAt: epochMs('updated_at').notNull().default(nowMs)
	},
	(table) => [
		uniqueIndex('app_operations_app_key_unique').on(table.appId, table.key),
		index('app_operations_group_idx').on(table.appId, table.groupLabel),
		check('app_operations_kind_enum', enumCheck(table.kind.name, OPERATION_KINDS)),
		check('app_operations_mode_enum', enumCheck(table.mode.name, OPERATION_MODES)),
		check('app_operations_active_bool', boolCheck(table.active.name)),
		check('app_operations_max_cost_positive', sql`${sql.identifier('max_cost_micro')} > 0`),
		check(
			'app_operations_margin_min',
			sql`${sql.identifier('margin_override_ppm')} IS NULL OR ${sql.identifier('margin_override_ppm')} >= 1000000`
		),
		check(
			'app_operations_temperature_range',
			sql`${sql.identifier('temperature_milli')} BETWEEN 0 AND 2000`
		),
		check('app_operations_timeout_positive', sql`${sql.identifier('timeout_ms')} > 0`),
		check(
			'app_operations_transcription_config_matches_kind',
			sql`(${sql.identifier('kind')} = 'transcription') = (${sql.identifier('transcription_config')} IS NOT NULL)`
		),
		check(
			'app_operations_active_needs_model',
			sql`${sql.identifier('active')} = 0 OR ${sql.identifier('kind')} = 'transcription' OR ${sql.identifier('model')} IS NOT NULL`
		),
		check(
			'app_operations_chat_needs_max_output',
			sql`${sql.identifier('kind')} <> 'chat' OR ${sql.identifier('max_output_tokens')} > 0`
		),
		check(
			'app_operations_estimated_cost_non_negative',
			sql`${sql.identifier('estimated_max_cost_micro_usd')} IS NULL OR ${sql.identifier('estimated_max_cost_micro_usd')} >= 0`
		),
		check('app_operations_fallback_models_json', jsonCheck(table.fallbackModels.name)),
		check('app_operations_capabilities_json', jsonCheck(table.capabilities.name)),
		check('app_operations_limits_json', jsonCheck(table.limits.name))
	]
);

export const promptTemplates = sqliteTable(
	'prompt_templates',
	{
		id: text('id').primaryKey(),
		operationId: text('operation_id')
			.notNull()
			.references(() => appOperations.id, { onDelete: 'restrict' }),
		version: integer('version').notNull(),
		messages: json<TemplateMessages>('messages').notNull(),
		variables: json<TemplateVariables>('variables')
			.notNull()
			.default(sql`'[]'`),
		responseFormat: json<ResponseFormat>('response_format'),
		tools: json<TemplateTools>('tools'),
		createdBy: text('created_by')
			.notNull()
			.references(() => user.id, { onDelete: 'restrict' }),
		createdAt: epochMs('created_at').notNull().default(nowMs)
	},
	(table) => [
		uniqueIndex('prompt_templates_operation_version_unique').on(table.operationId, table.version),
		check('prompt_templates_version_min', sql`${sql.identifier('version')} >= 1`),
		check('prompt_templates_messages_json', jsonCheck(table.messages.name)),
		check('prompt_templates_variables_json', jsonCheck(table.variables.name))
	]
);

export const settings = sqliteTable(
	'settings',
	{
		key: text('key').primaryKey(),
		value: json<SettingValue>('value').notNull(),
		updatedAt: epochMs('updated_at').notNull().default(nowMs)
	},
	(table) => [check('settings_value_json', jsonCheck(table.value.name))]
);
