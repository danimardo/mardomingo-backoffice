// API pública de `apps` (ARCHITECTURE.md §4): el resto de funcionalidades y las rutas solo importan este fichero.
export {
	createApp,
	createOperation,
	appAccessOf,
	appNamesOf,
	operationNamesOf,
	operationKeysOf,
	activeAppsForPanel,
	type PanelApp,
	announcementsFor,
	appStatusOf,
	type AnnouncementDto,
	type AppStatusDto,
	chatOperationOf,
	type AppAccess,
	largestAudioMbOf,
	type ChatOperation,
	type ChatTemplate,
	createTemplateVersion,
	activeAppOrigins,
	findActiveAppBySlug,
	getEffectiveConfig,
	getSetting,
	resolveAppBySlug,
	supportEmail,
	setAppMaintenance,
	updateAppOverrides,
	updateSetting,
	type AppsDeps,
	type EffectiveConfig,
	type EffectiveOperation,
	type NewApp,
	type NewOperation,
	type NewTemplateVersionInput,
	type UpdateAppOverridesInput,
	type UpdateSettingInput
} from './service';
export type { AppSettings } from './config';
export { DEFAULT_PACKS, DEFAULT_SETTINGS, type DefaultPack } from './defaults';
export { seedApps, SECRETARIO_APP_ID } from './seed';
export { SECRETARIO_SYNC_SCHEMA } from './defaults';
export type { SyncSchema } from './json-schemas';
export { appHeadersOf, type AppHeaders } from './contract';
export { APPS_LOG_EVENTS, type AppsLogFields } from './events';

export { totalTimeoutMs, fitWithin, type TimedAttempt } from './domain/total-timeout';
export { CHAT_RETRY_WAITS_MS, operationTotalMs } from './domain/operation-timing';
export { syncSchemaOf, syncSchemaStampOf } from './service';
export { announcementsForPanel, type PanelAnnouncement } from './panel-announcements';

// Anuncios del administrador (T315). Las llama solo la composición (W49).
export {
	createAnnouncement,
	deactivateAnnouncement,
	updateAnnouncement,
	listAnnouncements,
	appOptionsForAnnouncements,
	validatedAnnouncement,
	type AnnouncementInput,
	type AnnouncementRow,
	type AnnouncementsAdminDeps
} from './announcements-admin';

export { appForAdmin, listAppsForAdmin, type AdminAppRow } from './admin-apps';

// Activación de operaciones de IA (W41; T311). La comprobación del modelo vive en `ai`.
export {
	activateOperation,
	deactivateOperation,
	type ActivationCheck,
	type ActivationRejection
} from './activation';
export { operationForAdmin, operationsInGroup, type AdminOperationRow } from './admin-apps';
export {
	updateOperationSettings,
	OperationSafeSettings,
	type OperationSafeSettings as OperationSafeSettingsValue
} from './operation-settings';

// Previsualización de cambios de parámetros económicos (W38; T309). No escribe.
export { previewSettingChange, type SettingPreview } from './setting-preview';
