// Servicio de `apps` (BE-FR-61, 62, 31). La configuración se resuelve con la herencia global → app → operación; cada
// cambio se valida antes de guardarse y se audita en la misma transacción `BEGIN IMMEDIATE` (BE-FR-55). Las lecturas
// usan `db`: dentro de una transacción de better-sqlite3 (una sola conexión) ya ven los cambios de la transacción.
import type { Clock } from '$lib/server/adapters/clock/clock';
import type { Db } from '$lib/server/db/client';
import { immediateTransaction } from '$lib/server/db/tx';
import { recordEntry } from '$lib/server/features/audit';
import type { Logger } from '$lib/server/logging/logger';
import { AppError } from '$lib/server/shared/errors';
import type { IdGenerator } from '$lib/server/shared/ids';
import { toMicro, toMicroUsd, toPpm } from '$lib/shared/money';
import { cachedSettings, invalidateSettings, storeSettings } from './config.cache';
import { CHAT_RETRY_WAITS_MS, operationTotalMs } from './domain/operation-timing';
import { isVisible } from './domain/announcements';
import {
	operationRuleIssues,
	overrideCeilingIssues,
	resolveAppSettings,
	resolveMarginPpm,
	resolveOperationLimits,
	type AppSettings,
	type GlobalNumbers
} from './config';
import {
	AllowedOrigins,
	AppLinks,
	Capabilities,
	ClientTypes,
	FallbackModels,
	OperationLimits,
	PromptTemplateBody,
	SETTING_SCHEMAS,
	SettingsOverrides,
	SyncSchema,
	TranscriptionConfig,
	isSettingKey,
	parseSettingValue,
	type ResponseFormat,
	type SettingKey,
	type SettingValue,
	type TemplateMessages,
	type TemplateTools,
	type TemplateVariables
} from './json-schemas';
import {
	insertApp,
	insertOperation,
	insertTemplate,
	latestTemplateVersion,
	listAppOverrides,
	readApp,
	readCurrentTemplate,
	listApps,
	listAnnouncementCandidates,
	listOperations,
	readAppBySlug,
	readAppUpdatedAt,
	readOperation,
	readOperationById,
	readSettings,
	readSettingValue,
	updateOverrides,
	upsertSetting
} from './repository';
import type { OperationKind } from './defaults';

export interface AppsDeps {
	readonly db: Db;
	readonly logger: Logger;
	readonly clock: Clock;
	readonly ids: IdGenerator;
}

/** Valor que sustituye a una dirección de email en la auditoría (3.7: nunca emails). */
const REDACTED = '[redactado]';

/** Un importe de entrada es un entero seguro no negativo (lo que admiten las columnas de importe). */
function isSafeNonNegative(value: number): boolean {
	return Number.isSafeInteger(value) && value >= 0;
}

/** Convierte un importe opcional a su marca; ausente = nulo. */
function optionalAmount<T>(
	value: number | null | undefined,
	convert: (amount: number) => T
): T | null {
	return value === undefined || value === null ? null : convert(value);
}

/** Un parámetro global cuya subida no puede dejar por debajo ninguna sobrescritura de app. */
function isCeilingKey(
	key: SettingKey
): key is 'ai_requests_per_minute' | 'max_concurrent_transcriptions' {
	return key === 'ai_requests_per_minute' || key === 'max_concurrent_transcriptions';
}

export interface EffectiveOperation {
	readonly key: string;
	readonly kind: OperationKind;
	readonly model: string | null;
	readonly fallbackModels: readonly string[];
	readonly marginPpm: number;
	readonly limits: { readonly max_text_chars: number; readonly max_image_mb: number };
	readonly timeoutMs: number;
	readonly maxCostMicro: number;
	readonly maxOutputTokens: number | null;
}

export interface EffectiveConfig {
	readonly appId: string;
	readonly settings: AppSettings;
	readonly operation: EffectiveOperation | null;
}

/** Lee un parámetro numérico global; si falta o no es numérico, es un error interno (el _seed_ lo siembra). */
function globalNumber(values: ReadonlyMap<SettingKey, SettingValue>, key: SettingKey): number {
	const value = values.get(key);
	if (typeof value !== 'number')
		throw new AppError('INTERNAL_ERROR', { reason: 'settings_missing' });
	return value;
}

function globalNumbers(values: ReadonlyMap<SettingKey, SettingValue>): GlobalNumbers {
	return {
		ai_requests_per_minute: globalNumber(values, 'ai_requests_per_minute'),
		max_concurrent_transcriptions: globalNumber(values, 'max_concurrent_transcriptions'),
		max_audio_seconds: globalNumber(values, 'max_audio_seconds'),
		audio_duration_tolerance_seconds: globalNumber(values, 'audio_duration_tolerance_seconds'),
		max_audio_mb: globalNumber(values, 'max_audio_mb'),
		max_text_chars: globalNumber(values, 'max_text_chars'),
		max_image_mb: globalNumber(values, 'max_image_mb'),
		max_sync_doc_kb: globalNumber(values, 'max_sync_doc_kb')
	};
}

/** Parámetros globales, desde la caché o desde la BD (y entonces se guardan en caché). */
function loadSettings(deps: AppsDeps): ReadonlyMap<SettingKey, SettingValue> {
	const cached = cachedSettings(deps.db);
	if (cached !== undefined) return cached;
	const values = readSettings(deps.db, deps.logger);
	storeSettings(deps.db, values);
	return values;
}

/** Configuración efectiva de una app, y de una operación si se indica (BE-FR-61 CA2). */
/** Acceso de una app para `protections`: versiones, mantenimiento propio y el global (FR-073, FR-074, T191). */
export interface AppAccess {
	readonly enforceVersion: boolean;
	readonly minAppVersion: string | null;
	readonly recommendedAppVersion: string | null;
	readonly maintenance: { readonly active: boolean; readonly message: string };
	readonly globalMaintenance: { readonly active: boolean; readonly message: string };
}

/** Lee lo necesario para decidir el acceso de una petición a la app; `undefined` si la app no existe. */
export function appAccessOf(deps: AppsDeps, appId: string): AppAccess | undefined {
	const app = readApp(deps.db, deps.logger, appId);
	if (app === undefined) return undefined;
	const global = SETTING_SCHEMAS.maintenance.safeParse(getSetting(deps, 'maintenance'));
	if (!global.success) throw new AppError('INTERNAL_ERROR', { reason: 'settings_missing' });
	return {
		enforceVersion: app.enforceVersion,
		minAppVersion: app.minAppVersion,
		recommendedAppVersion: app.recommendedAppVersion,
		maintenance: { active: app.maintenanceActive, message: app.maintenanceMessage },
		globalMaintenance: global.data
	};
}

/** Mayor `max_audio_mb` efectivo entre el global y las apps: el límite del cuerpo debe cubrirlo (FR-070, T185). */
export function largestAudioMbOf(deps: AppsDeps): number {
	const global = getSetting(deps, 'max_audio_mb');
	if (typeof global !== 'number')
		throw new AppError('INTERNAL_ERROR', { reason: 'settings_missing' });
	return listApps(deps.db, deps.logger).reduce(
		(largest, app) => Math.max(largest, app.settingsOverrides.max_audio_mb ?? global),
		global
	);
}

/** Plantilla vigente tal como la usa `ai` para renderizar una petición (3.3, 3.5). */
export interface ChatTemplate {
	readonly id: string;
	readonly version: number;
	readonly messages: TemplateMessages;
	readonly variables: TemplateVariables;
	readonly responseFormat: ResponseFormat | null;
	readonly tools: TemplateTools | null;
}

/** Operación completa para atender una petición de chat: campos de la operación y su plantilla vigente si es `plantilla`. */
export interface ChatOperation {
	readonly id: string;
	readonly appId: string;
	readonly key: string;
	readonly kind: OperationKind;
	readonly mode: 'libre' | 'plantilla';
	readonly active: boolean;
	readonly model: string | null;
	readonly fallbackModels: readonly string[];
	readonly preferredProvider: string | null;
	readonly temperatureMilli: number;
	readonly maxOutputTokens: number | null;
	readonly maxCostMicro: number;
	readonly estimatedMaxCostMicroUsd: number | null;
	readonly timeoutMs: number;
	readonly capabilities: Capabilities;
	readonly limits: OperationLimits;
	/** Configuración de transcripción (principal, respaldo y reintentos); `null` en las demás operaciones. */
	readonly transcription: TranscriptionConfig | null;
	readonly template: ChatTemplate | null;
}

/** Lee la operación de una app para atender una petición; `undefined` si la clave no existe en esa app. */
export function chatOperationOf(
	deps: AppsDeps,
	appId: string,
	key: string
): ChatOperation | undefined {
	const row = readOperation(deps.db, deps.logger, appId, key);
	if (row === undefined) return undefined;
	const templateRow =
		row.mode === 'plantilla' ? readCurrentTemplate(deps.db, deps.logger, row.id) : undefined;
	const template: ChatTemplate | null =
		templateRow === undefined
			? null
			: {
					id: templateRow.id,
					version: templateRow.version,
					messages: templateRow.messages,
					variables: templateRow.variables,
					responseFormat: templateRow.responseFormat ?? null,
					tools: templateRow.tools ?? null
				};
	return {
		id: row.id,
		appId: row.appId,
		key: row.key,
		kind: row.kind,
		mode: row.mode,
		active: row.active,
		model: row.model,
		fallbackModels: row.fallbackModels,
		preferredProvider: row.preferredProvider,
		temperatureMilli: row.temperatureMilli,
		maxOutputTokens: row.maxOutputTokens,
		maxCostMicro: row.maxCostMicro,
		estimatedMaxCostMicroUsd: row.estimatedMaxCostMicroUsd,
		timeoutMs: row.timeoutMs,
		capabilities: row.capabilities,
		limits: row.limits,
		transcription: row.transcriptionConfig ?? null,
		template
	};
}

export function getEffectiveConfig(
	deps: AppsDeps,
	input: { readonly appId: string; readonly operationKey?: string }
): EffectiveConfig {
	const app = readApp(deps.db, deps.logger, input.appId);
	if (app === undefined) throw new AppError('UNKNOWN_APP', { field: 'app' });

	const values = loadSettings(deps);
	const globals = globalNumbers(values);
	const settings = resolveAppSettings(globals, app.settingsOverrides);
	if (input.operationKey === undefined) return { appId: app.id, settings, operation: null };

	const operation = readOperation(deps.db, deps.logger, app.id, input.operationKey);
	// BE-FR-31: solo las operaciones activas se atienden; cualquier otra es una petición no válida.
	if (operation === undefined || !operation.active) {
		throw new AppError('VALIDATION_ERROR', { field: 'operation' });
	}
	const marginGlobal = globalNumber(values, 'margin_global');
	return {
		appId: app.id,
		settings,
		operation: {
			key: operation.key,
			kind: operation.kind,
			model: operation.model,
			fallbackModels: operation.fallbackModels,
			marginPpm: resolveMarginPpm(marginGlobal, operation.marginOverridePpm),
			limits: resolveOperationLimits(settings, operation.limits),
			timeoutMs: operation.timeoutMs,
			maxCostMicro: operation.maxCostMicro,
			maxOutputTokens: operation.maxOutputTokens
		}
	};
}

function requireReason(reason: string): void {
	if (reason.trim() === '') throw new AppError('VALIDATION_ERROR', { field: 'reason' });
}

/** Un error de restricción de SQLite (`CHECK`, `UNIQUE`, `FOREIGN KEY`) es una entrada no válida, no un fallo. */
function isConstraintError(error: unknown): boolean {
	return (
		error instanceof Error &&
		'code' in error &&
		typeof error.code === 'string' &&
		error.code.startsWith('SQLITE_CONSTRAINT')
	);
}

function snapshotOf(key: SettingKey, value: SettingValue | undefined): { value: unknown } | null {
	if (value === undefined) return null;
	return { value: key === 'support_email' ? REDACTED : value };
}

export interface UpdateSettingInput {
	readonly actorId: string;
	readonly key: string;
	readonly value: unknown;
	readonly reason: string;
}

/** Cambia un parámetro global (BE-FR-61 CA1, CA4): valida tipo y rango, y audita valor anterior y nuevo. */
export function updateSetting(deps: AppsDeps, input: UpdateSettingInput): void {
	requireReason(input.reason);
	if (!isSettingKey(input.key)) throw new AppError('VALIDATION_ERROR', { field: 'key' });
	const key = input.key;
	const parsed = parseSettingValue(key, input.value);
	if (!parsed.success) {
		deps.logger.emit('apps.settings.rejected', { key, scope: 'global', reason: 'validation' });
		throw new AppError('VALIDATION_ERROR', { field: 'value' });
	}
	const value = parsed.data;
	const now = deps.clock.now();

	immediateTransaction(deps.db, (tx) => {
		const before = readSettingValue(deps.db, deps.logger, key);
		if (isCeilingKey(key) && typeof value === 'number') {
			// Un global no puede quedar por debajo de una sobrescritura ya concedida a una app (3.2).
			const breaches = listAppOverrides(deps.db, deps.logger).filter((overrides) => {
				const current = overrides[key];
				return current !== undefined && current > value;
			});
			if (breaches.length > 0) {
				deps.logger.emit('apps.settings.rejected', { key, scope: 'global', reason: 'ceiling' });
				throw new AppError('VALIDATION_ERROR', { field: 'value' });
			}
		}
		upsertSetting(tx, key, value, now);
		recordEntry(
			tx,
			{
				adminId: input.actorId,
				action: 'apps.setting.update',
				entity: 'setting',
				entityId: key,
				before: snapshotOf(key, before),
				after: snapshotOf(key, value),
				reason: input.reason
			},
			{ clock: deps.clock, ids: deps.ids, logger: deps.logger }
		);
	});
	invalidateSettings(deps.db);
	deps.logger.emit('apps.settings.updated', { key, scope: 'global' });
}

export interface UpdateAppOverridesInput {
	readonly actorId: string;
	readonly appId: string;
	readonly overrides: unknown;
	readonly reason: string;
}

/** Cambia las sobrescrituras de una app (BE-FR-61 CA3): cada valor ≤ su global, y auditoría con la misma transacción. */
export function updateAppOverrides(deps: AppsDeps, input: UpdateAppOverridesInput): void {
	requireReason(input.reason);
	const parsed = SettingsOverrides.safeParse(input.overrides);
	if (!parsed.success) {
		deps.logger.emit('apps.settings.rejected', {
			key: 'settings_overrides',
			scope: 'app',
			reason: 'validation'
		});
		throw new AppError('VALIDATION_ERROR', { field: 'settings_overrides' });
	}
	const overrides = parsed.data;
	const now = deps.clock.now();

	immediateTransaction(deps.db, (tx) => {
		const app = readApp(deps.db, deps.logger, input.appId);
		if (app === undefined) throw new AppError('UNKNOWN_APP', { field: 'app' });
		const globals = globalNumbers(loadSettings(deps));
		if (overrideCeilingIssues(overrides, globals).length > 0) {
			deps.logger.emit('apps.settings.rejected', {
				key: 'settings_overrides',
				scope: 'app',
				reason: 'ceiling'
			});
			throw new AppError('VALIDATION_ERROR', { field: 'settings_overrides' });
		}
		updateOverrides(tx, app.id, overrides, now);
		recordEntry(
			tx,
			{
				adminId: input.actorId,
				action: 'apps.settings.update',
				entity: 'app',
				entityId: app.id,
				before: { settings_overrides: app.settingsOverrides },
				after: { settings_overrides: overrides },
				reason: input.reason
			},
			{ clock: deps.clock, ids: deps.ids, logger: deps.logger }
		);
	});
	deps.logger.emit('apps.settings.updated', { key: 'settings_overrides', scope: 'app' });
}

export interface NewApp {
	readonly slug: string;
	readonly name: string;
	readonly description?: string;
	readonly clientTypes: unknown;
	readonly links: unknown;
	readonly syncSchema: unknown;
	readonly allowedOrigins?: unknown;
	readonly settingsOverrides?: unknown;
	readonly minAppVersion?: string | null;
	readonly recommendedAppVersion?: string | null;
	readonly enforceVersion?: boolean;
	readonly supportEmail?: string | null;
	readonly postVerifyText?: string | null;
}

/** Alta de una app sin redesplegar (BE-FR-62). Valida las columnas JSON y la coherencia de versiones. */
export function createApp(deps: AppsDeps, actorId: string, input: NewApp): string {
	const clientTypes = ClientTypes.safeParse(input.clientTypes);
	const links = AppLinks.safeParse(input.links);
	const syncSchema = SyncSchema.safeParse(input.syncSchema);
	const allowedOrigins = AllowedOrigins.safeParse(input.allowedOrigins ?? []);
	const overrides = SettingsOverrides.safeParse(input.settingsOverrides ?? {});
	const enforceVersion = input.enforceVersion ?? false;
	const invalid =
		!clientTypes.success ||
		!links.success ||
		!syncSchema.success ||
		!allowedOrigins.success ||
		!overrides.success ||
		(enforceVersion && (input.minAppVersion ?? null) === null);
	if (invalid) throw new AppError('VALIDATION_ERROR', { field: 'app' });
	if (readAppBySlug(deps.db, deps.logger, input.slug) !== undefined)
		throw new AppError('SLUG_TAKEN');

	const id = deps.ids('app');
	const now = deps.clock.now();
	immediateTransaction(deps.db, (tx) => {
		try {
			insertApp(tx, {
				id,
				slug: input.slug,
				name: input.name,
				description: input.description ?? '',
				clientTypes: clientTypes.data,
				status: 'active',
				links: links.data,
				minAppVersion: input.minAppVersion ?? null,
				recommendedAppVersion: input.recommendedAppVersion ?? null,
				enforceVersion,
				maintenanceActive: false,
				maintenanceMessage: '',
				allowedOrigins: allowedOrigins.data,
				postVerifyText: input.postVerifyText ?? null,
				settingsOverrides: overrides.data,
				syncSchema: syncSchema.data,
				supportEmail: input.supportEmail ?? null,
				createdAt: now,
				updatedAt: now
			});
		} catch (error) {
			if (isConstraintError(error)) throw new AppError('VALIDATION_ERROR', { field: 'app' });
			throw error;
		}
		recordEntry(
			tx,
			{
				adminId: actorId,
				action: 'apps.app.create',
				entity: 'app',
				entityId: id,
				before: null,
				after: { slug: input.slug, name: input.name, status: 'active' },
				reason: null
			},
			{ clock: deps.clock, ids: deps.ids, logger: deps.logger }
		);
	});
	return id;
}

export interface NewOperation {
	readonly key: string;
	readonly name: string;
	readonly kind: OperationKind;
	readonly mode?: 'libre' | 'plantilla';
	readonly model?: string | null;
	readonly fallbackModels?: unknown;
	readonly preferredProvider?: string | null;
	readonly marginOverridePpm?: number | null;
	readonly temperatureMilli?: number;
	readonly maxOutputTokens?: number | null;
	readonly maxCostMicro: number;
	readonly estimatedMaxCostMicroUsd?: number | null;
	readonly timeoutMs: number;
	readonly capabilities: unknown;
	readonly limits?: unknown;
	readonly transcriptionConfig?: unknown;
	readonly groupLabel?: string | null;
	readonly active?: boolean;
}

/** Alta de una operación del catálogo (BE-FR-77): sus reglas de coherencia se comprueban antes de guardar. */
export function createOperation(
	deps: AppsDeps,
	actorId: string,
	appId: string,
	input: NewOperation
): string {
	const app = readApp(deps.db, deps.logger, appId);
	if (app === undefined) throw new AppError('UNKNOWN_APP', { field: 'app' });
	const fallbackModels = FallbackModels.safeParse(input.fallbackModels ?? []);
	const capabilities = Capabilities.safeParse(input.capabilities);
	const limits = OperationLimits.safeParse(input.limits ?? {});
	const transcription =
		input.transcriptionConfig === undefined || input.transcriptionConfig === null
			? { success: true as const, data: null }
			: TranscriptionConfig.safeParse(input.transcriptionConfig);
	const active = input.active ?? false;
	const rules = operationRuleIssues({
		kind: input.kind,
		active,
		model: input.model ?? null,
		fallbackModels: fallbackModels.success ? fallbackModels.data : [],
		maxOutputTokens: input.maxOutputTokens ?? null,
		transcriptionConfig: transcription.success ? transcription.data : null,
		marginOverridePpm: input.marginOverridePpm ?? null
	});
	// Los importes deben ser enteros seguros y no negativos antes de convertirlos a sus marcas (si no, lanzan).
	const amounts = [
		input.maxCostMicro,
		input.timeoutMs,
		input.marginOverridePpm,
		input.estimatedMaxCostMicroUsd
	];
	const badAmount = amounts.some(
		(amount) => amount !== undefined && amount !== null && !isSafeNonNegative(amount)
	);
	if (
		!fallbackModels.success ||
		!capabilities.success ||
		!limits.success ||
		!transcription.success ||
		badAmount ||
		rules.length > 0
	)
		throw new AppError('VALIDATION_ERROR', { field: 'operation' });
	if (readOperation(deps.db, deps.logger, appId, input.key) !== undefined) {
		throw new AppError('VALIDATION_ERROR', { field: 'key' });
	}

	const id = deps.ids('aop');
	const now = deps.clock.now();
	immediateTransaction(deps.db, (tx) => {
		try {
			insertOperation(tx, {
				id,
				appId,
				key: input.key,
				name: input.name,
				kind: input.kind,
				mode: input.mode ?? 'libre',
				model: input.model ?? null,
				fallbackModels: fallbackModels.data,
				preferredProvider: input.preferredProvider ?? null,
				marginOverridePpm: optionalAmount(input.marginOverridePpm, toPpm),
				temperatureMilli: input.temperatureMilli ?? 700,
				maxOutputTokens: input.maxOutputTokens ?? null,
				maxCostMicro: toMicro(input.maxCostMicro),
				estimatedMaxCostMicroUsd: optionalAmount(input.estimatedMaxCostMicroUsd, toMicroUsd),
				timeoutMs: input.timeoutMs,
				capabilities: capabilities.data,
				limits: limits.data,
				transcriptionConfig: transcription.data,
				groupLabel: input.groupLabel ?? null,
				active,
				createdAt: now,
				updatedAt: now
			});
		} catch (error) {
			if (isConstraintError(error)) throw new AppError('VALIDATION_ERROR', { field: 'operation' });
			throw error;
		}
		recordEntry(
			tx,
			{
				adminId: actorId,
				action: 'apps.operation.create',
				entity: 'app_operation',
				entityId: id,
				before: null,
				after: { key: input.key, kind: input.kind, active },
				reason: null
			},
			{ clock: deps.clock, ids: deps.ids, logger: deps.logger }
		);
	});
	return id;
}

export interface NewTemplateVersionInput {
	readonly actorId: string;
	readonly operationId: string;
	readonly body: unknown;
}

/** Publica una versión nueva de la plantilla de una operación `plantilla` (BE-FR-78, 79). Nunca edita la anterior. */
export function createTemplateVersion(deps: AppsDeps, input: NewTemplateVersionInput): number {
	const operation = readOperationById(deps.db, deps.logger, input.operationId);
	if (operation === undefined || operation.mode !== 'plantilla') {
		throw new AppError('VALIDATION_ERROR', { field: 'operation' });
	}
	const parsed = PromptTemplateBody.safeParse(input.body);
	if (!parsed.success) throw new AppError('VALIDATION_ERROR', { field: 'body' });
	const body = parsed.data;
	const id = deps.ids('tpl');
	const now = deps.clock.now();

	return immediateTransaction(deps.db, (tx) => {
		const version = (latestTemplateVersion(deps.db, operation.id) ?? 0) + 1;
		insertTemplate(tx, {
			id,
			operationId: operation.id,
			version,
			messages: body.messages,
			variables: body.variables,
			responseFormat: body.response_format ?? null,
			tools: body.tools ?? null,
			createdBy: input.actorId,
			createdAt: now
		});
		recordEntry(
			tx,
			{
				adminId: input.actorId,
				action: 'apps.template.version',
				entity: 'prompt_template',
				entityId: id,
				before: null,
				after: { version },
				reason: null
			},
			{ clock: deps.clock, ids: deps.ids, logger: deps.logger }
		);
		deps.logger.emit('apps.template.versioned', { version });
		return version;
	});
}

/** Parámetro global (`settings`) por clave, o `undefined` si la clave no existe. Lo usan otras funcionalidades. */
export function getSetting(deps: AppsDeps, key: SettingKey): SettingValue | undefined {
	return loadSettings(deps).get(key);
}

/** App activa por su slug (`X-App-Id`, `?app=`). Una app desactivada se trata como desconocida (BE-FR-62). */
export function findActiveAppBySlug(
	deps: AppsDeps,
	slug: string
): { readonly id: string; readonly name: string } | undefined {
	const app = readAppBySlug(deps.db, deps.logger, slug);
	if (app === undefined || app.status !== 'active') return undefined;
	return { id: app.id, name: app.name };
}

/** App por su slug, desactivada incluida: el paso «app» distingue `APP_DISABLED` de `UNKNOWN_APP` (BE-FR-62). */
export function resolveAppBySlug(
	deps: AppsDeps,
	slug: string
):
	| {
			readonly id: string;
			readonly slug: string;
			readonly name: string;
			readonly status: 'active' | 'disabled';
			readonly allowedOrigins: readonly string[];
	  }
	| undefined {
	const app = readAppBySlug(deps.db, deps.logger, slug);
	if (app === undefined) return undefined;
	return {
		id: app.id,
		slug: app.slug,
		name: app.name,
		status: app.status,
		allowedOrigins: app.allowedOrigins
	};
}

/** Orígenes permitidos por alguna app activa: el _preflight_ de CORS solo pide que el origen figure en alguna (T131). */
export function activeAppOrigins(deps: AppsDeps): readonly string[] {
	return listApps(deps.db, deps.logger)
		.filter((app) => app.status === 'active')
		.flatMap((app) => app.allowedOrigins);
}

/** Email de soporte global (`support_email`, BE-FR-58): el que va en el pie de los emails y en Reply-To. */
export function supportEmail(deps: AppsDeps): string {
	const value = getSetting(deps, 'support_email');
	return typeof value === 'string' ? value : 'soporte@mardomingo.com';
}

// ---------------------------------------------------------------------------------------------------------------------
// Estado de la app para `/app/status` (E01; BE-FR-48 CA2, BE-FR-77 CA4, BE-FR-84, BE-FR-85; T193)

export interface AnnouncementDto {
	readonly id: string;
	readonly level: 'info' | 'warning' | 'critical';
	readonly message: string;
	readonly link: string | null;
	readonly endsAt: string | null;
}

/** Anuncios visibles para una app y versión en un instante (api-v1 E01). */
export function announcementsFor(
	deps: AppsDeps,
	input: { readonly appId: string; readonly version: string | null; readonly now: number }
): AnnouncementDto[] {
	return listAnnouncementCandidates(deps.db, input.appId)
		.filter((row) => isVisible(row, input))
		.map((row) => ({
			id: row.id,
			level: row.level,
			message: row.message,
			link: row.link,
			endsAt: row.endsAt === null ? null : new Date(row.endsAt).toISOString()
		}));
}

/** Tiempo máximo total de cada operación activa, con la política de intentos de `ai` (T193). */
function operationTimeouts(
	deps: AppsDeps,
	appId: string
): Record<string, { readonly timeoutMs: number }> {
	const entries = listOperations(deps.db, deps.logger, appId)
		.filter((operation) => operation.active)
		.map((operation) => {
			const transcription = operation.transcriptionConfig;
			const timeoutMs =
				operation.kind === 'transcription' && transcription !== null
					? operationTotalMs({
							primaryTimeoutMs: transcription.primary.timeout_ms,
							retryWaitsMs: transcription.primary.enabled
								? transcription.primary.retry_delays_ms
								: [],
							fallbackTimeoutsMs:
								transcription.backup === null ? [] : [transcription.backup.timeout_ms]
						})
					: operationTotalMs({
							primaryTimeoutMs: operation.timeoutMs,
							retryWaitsMs: CHAT_RETRY_WAITS_MS,
							fallbackTimeoutsMs: operation.fallbackModels.map(() => operation.timeoutMs)
						});
			return [operation.key, { timeoutMs }] as const;
		});
	return Object.fromEntries(entries);
}

export interface AppStatusDto {
	readonly app: { readonly id: string; readonly name: string };
	readonly minAppVersion: string | null;
	readonly recommendedAppVersion: string | null;
	readonly maintenance: { readonly active: boolean; readonly message: string };
	readonly limits: { readonly maxAudioSeconds: number };
	readonly operations: Readonly<Record<string, { readonly timeoutMs: number }>>;
	readonly links: Readonly<
		Record<
			| 'register'
			| 'forgotPassword'
			| 'panel'
			| 'buyCredits'
			| 'prices'
			| 'terms'
			| 'privacy'
			| 'acceptableUse',
			string
		>
	>;
	readonly supportEmail: string;
	readonly announcements: readonly AnnouncementDto[];
}

/**
 * Estado público de una app. Nunca bloquea: informa del mantenimiento y de la versión, y no exige versión ni sesión. Los
 * enlaces salen de la URL pública de la web (`webBaseUrl`).
 */
export function appStatusOf(
	deps: AppsDeps,
	input: {
		readonly appId: string;
		readonly version: string | null;
		readonly now: number;
		readonly webBaseUrl: string;
	}
): AppStatusDto | undefined {
	const app = readApp(deps.db, deps.logger, input.appId);
	const access = appAccessOf(deps, input.appId);
	if (app === undefined || access === undefined) return undefined;
	const web = input.webBaseUrl.replace(/\/$/, '');
	const maintenance = access.globalMaintenance.active
		? access.globalMaintenance
		: { active: access.maintenance.active, message: access.maintenance.message };
	return {
		app: { id: app.slug, name: app.name },
		minAppVersion: access.minAppVersion,
		recommendedAppVersion: access.recommendedAppVersion,
		maintenance: { active: maintenance.active, message: maintenance.message },
		limits: {
			maxAudioSeconds: getEffectiveConfig(deps, { appId: input.appId }).settings.max_audio_seconds
		},
		operations: operationTimeouts(deps, input.appId),
		links: {
			register: `${web}/registro?app=${encodeURIComponent(app.slug)}`,
			forgotPassword: `${web}/recuperar`,
			panel: `${web}/panel`,
			buyCredits: `${web}/panel/comprar`,
			prices: `${web}/precios`,
			terms: `${web}/terminos`,
			privacy: `${web}/privacidad`,
			acceptableUse: `${web}/uso-aceptable`
		},
		supportEmail: supportEmail(deps),
		announcements: announcementsFor(deps, input)
	};
}

/** Fecha de última modificación del esquema de la app, para la caché de `sync`. */
export function syncSchemaStampOf(deps: AppsDeps, appId: string): number {
	const updatedAt = readAppUpdatedAt(deps.db, appId);
	if (updatedAt === undefined) throw new AppError('UNKNOWN_APP', { field: 'app' });
	return updatedAt;
}

/** Esquema de sincronización de la app: categorías y estrategias que el documento debe respetar (BE-FR-39). */
export function syncSchemaOf(deps: AppsDeps, appId: string): SyncSchema {
	const app = readApp(deps.db, deps.logger, appId);
	if (app === undefined) throw new AppError('UNKNOWN_APP', { field: 'app' });
	return app.syncSchema;
}
