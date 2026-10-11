// Lectura y escritura de `apps`, `app_operations`, `prompt_templates` y `settings`. Al leer, cada columna JSON se
// valida con su esquema: si no encaja, se emite `apps.config.corrupt`, se rechaza la lectura con un error
// controlado y el dato NO se modifica (BE-FR-61 CA5, data-model 3).
import { and, desc, eq } from 'drizzle-orm';
import type { ZodType } from 'zod';
import type { Db } from '$lib/server/db/client';
import type { Tx } from '$lib/server/db/tx';
import type { Logger } from '$lib/server/logging/logger';
import { AppError } from '$lib/server/shared/errors';
import type { EpochMs } from '$lib/shared/time';
import { apps, appOperations, promptTemplates, settings } from './schema';
import {
	AllowedOrigins,
	AppLinks,
	Capabilities,
	ClientTypes,
	FallbackModels,
	OperationLimits,
	ResponseFormat,
	SettingsOverrides,
	SyncSchema,
	TemplateMessages,
	TemplateTools,
	TemplateVariables,
	TranscriptionConfig,
	isSettingKey,
	parseSettingValue,
	type SettingKey,
	type SettingValue
} from './json-schemas';

export type AppRow = typeof apps.$inferSelect;
export type OperationRow = typeof appOperations.$inferSelect;
export type TemplateRow = typeof promptTemplates.$inferSelect;
export type AppInsert = typeof apps.$inferInsert;
export type OperationInsert = typeof appOperations.$inferInsert;
export type TemplateInsert = typeof promptTemplates.$inferInsert;

/** Error controlado por una columna que no encaja con su esquema. No incluye el valor. */
function corruptError(logger: Logger, table: string, field: string): AppError {
	logger.emit('apps.config.corrupt', { table, field });
	return new AppError('INTERNAL_ERROR', { reason: 'config_corrupt' });
}

/** Valida un valor leído de la BD con su esquema; si no encaja, error controlado. */
function checked<T>(
	schema: ZodType<T>,
	value: unknown,
	logger: Logger,
	table: string,
	field: string
): T {
	const result = schema.safeParse(value);
	if (!result.success) throw corruptError(logger, table, field);
	return result.data;
}

/** Lee una fila con SQLite; un JSON mal formado (sin esquema posible) también es corrupción. */
function readGuarded<T>(logger: Logger, table: string, read: () => T): T {
	try {
		return read();
	} catch (error) {
		if (error instanceof SyntaxError) throw corruptError(logger, table, 'json');
		throw error;
	}
}

export function readApp(db: Db, logger: Logger, id: string): AppRow | undefined {
	const row = readGuarded(logger, 'apps', () =>
		db.select().from(apps).where(eq(apps.id, id)).get()
	);
	if (row === undefined) return undefined;
	return validatedApp(row, logger);
}

export function readAppBySlug(db: Db, logger: Logger, slug: string): AppRow | undefined {
	const row = readGuarded(logger, 'apps', () =>
		db.select().from(apps).where(eq(apps.slug, slug)).get()
	);
	if (row === undefined) return undefined;
	return validatedApp(row, logger);
}

/** Todas las apps con sus sobrescrituras validadas (para comprobar los topes frente al global). */
export function listAppOverrides(db: Db, logger: Logger): SettingsOverrides[] {
	const rows = readGuarded(logger, 'apps', () => db.select().from(apps).all());
	return rows.map((row) => validatedApp(row, logger).settingsOverrides);
}

function validatedApp(row: AppRow, logger: Logger): AppRow {
	return {
		...row,
		clientTypes: checked(ClientTypes, row.clientTypes, logger, 'apps', 'client_types'),
		links: checked(AppLinks, row.links, logger, 'apps', 'links'),
		allowedOrigins: checked(AllowedOrigins, row.allowedOrigins, logger, 'apps', 'allowed_origins'),
		settingsOverrides: checked(
			SettingsOverrides,
			row.settingsOverrides,
			logger,
			'apps',
			'settings_overrides'
		),
		syncSchema: checked(SyncSchema, row.syncSchema, logger, 'apps', 'sync_schema')
	};
}

export function readOperation(
	db: Db,
	logger: Logger,
	appId: string,
	key: string
): OperationRow | undefined {
	const row = readGuarded(logger, 'app_operations', () =>
		db
			.select()
			.from(appOperations)
			.where(and(eq(appOperations.appId, appId), eq(appOperations.key, key)))
			.get()
	);
	if (row === undefined) return undefined;
	return validatedOperation(row, logger);
}

export function listOperations(db: Db, logger: Logger, appId: string): OperationRow[] {
	const rows = readGuarded(logger, 'app_operations', () =>
		db.select().from(appOperations).where(eq(appOperations.appId, appId)).all()
	);
	return rows.map((row) => validatedOperation(row, logger));
}

function validatedOperation(row: OperationRow, logger: Logger): OperationRow {
	return {
		...row,
		fallbackModels: checked(
			FallbackModels,
			row.fallbackModels,
			logger,
			'app_operations',
			'fallback_models'
		),
		capabilities: checked(Capabilities, row.capabilities, logger, 'app_operations', 'capabilities'),
		limits: checked(OperationLimits, row.limits, logger, 'app_operations', 'limits'),
		transcriptionConfig:
			row.transcriptionConfig === null
				? null
				: checked(
						TranscriptionConfig,
						row.transcriptionConfig,
						logger,
						'app_operations',
						'transcription_config'
					)
	};
}

export function readTemplate(db: Db, logger: Logger, id: string): TemplateRow | undefined {
	const row = readGuarded(logger, 'prompt_templates', () =>
		db.select().from(promptTemplates).where(eq(promptTemplates.id, id)).get()
	);
	if (row === undefined) return undefined;
	return {
		...row,
		messages: checked(TemplateMessages, row.messages, logger, 'prompt_templates', 'messages'),
		variables: checked(TemplateVariables, row.variables, logger, 'prompt_templates', 'variables'),
		responseFormat:
			row.responseFormat === null
				? null
				: checked(
						ResponseFormat,
						row.responseFormat,
						logger,
						'prompt_templates',
						'response_format'
					),
		tools:
			row.tools === null
				? null
				: checked(TemplateTools, row.tools, logger, 'prompt_templates', 'tools')
	};
}

export function readOperationById(db: Db, logger: Logger, id: string): OperationRow | undefined {
	const row = readGuarded(logger, 'app_operations', () =>
		db.select().from(appOperations).where(eq(appOperations.id, id)).get()
	);
	if (row === undefined) return undefined;
	return validatedOperation(row, logger);
}

/** Versión vigente de una operación: la de mayor `version`, o `undefined` si nunca se ha publicado. */
export function latestTemplateVersion(db: Db, operationId: string): number | undefined {
	return db
		.select({ version: promptTemplates.version })
		.from(promptTemplates)
		.where(eq(promptTemplates.operationId, operationId))
		.orderBy(desc(promptTemplates.version))
		.limit(1)
		.get()?.version;
}

/** Lee todos los parámetros de `settings`, cada uno validado con su esquema. */
export function readSettings(db: Db, logger: Logger): Map<SettingKey, SettingValue> {
	const rows = readGuarded(logger, 'settings', () => db.select().from(settings).all());
	const values = new Map<SettingKey, SettingValue>();
	for (const row of rows) {
		if (!isSettingKey(row.key)) throw corruptError(logger, 'settings', 'key');
		const key = row.key;
		const parsed = parseSettingValue(key, row.value);
		if (!parsed.success) throw corruptError(logger, 'settings', key);
		values.set(key, parsed.data);
	}
	return values;
}

export function readSettingValue(
	db: Db,
	logger: Logger,
	key: SettingKey
): SettingValue | undefined {
	const row = readGuarded(logger, 'settings', () =>
		db.select().from(settings).where(eq(settings.key, key)).get()
	);
	if (row === undefined) return undefined;
	const parsed = parseSettingValue(key, row.value);
	if (!parsed.success) throw corruptError(logger, 'settings', key);
	return parsed.data;
}

export function upsertSetting(tx: Tx, key: SettingKey, value: SettingValue, now: EpochMs): void {
	tx.insert(settings)
		.values({ key, value, updatedAt: now })
		.onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: now } })
		.run();
}

export function updateOverrides(
	tx: Tx,
	appId: string,
	overrides: SettingsOverrides,
	now: EpochMs
): void {
	tx.update(apps)
		.set({ settingsOverrides: overrides, updatedAt: now })
		.where(eq(apps.id, appId))
		.run();
}

export function insertApp(tx: Tx, row: AppInsert): void {
	tx.insert(apps).values(row).run();
}

export function insertOperation(tx: Tx, row: OperationInsert): void {
	tx.insert(appOperations).values(row).run();
}

export function insertTemplate(tx: Tx, row: TemplateInsert): void {
	tx.insert(promptTemplates).values(row).run();
}

/** Inserta sin tocar lo existente: el _seed_ es idempotente (dos ejecuciones, mismo resultado). */
export function seedInsertApp(tx: Tx, row: AppInsert): void {
	tx.insert(apps).values(row).onConflictDoNothing().run();
}

export function seedInsertOperation(tx: Tx, row: OperationInsert): void {
	tx.insert(appOperations).values(row).onConflictDoNothing().run();
}

export function seedInsertSetting(
	tx: Tx,
	key: SettingKey,
	value: SettingValue,
	now: EpochMs
): void {
	tx.insert(settings).values({ key, value, updatedAt: now }).onConflictDoNothing().run();
}

/** Todas las apps validadas, para los orígenes permitidos de las apps activas (CORS, T131). */
export function listApps(db: Db, logger: Logger): AppRow[] {
	return readGuarded(logger, 'apps', () => db.select().from(apps).all()).map((row) =>
		validatedApp(row, logger)
	);
}
