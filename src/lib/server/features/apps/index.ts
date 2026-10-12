// API pública de `apps` (ARCHITECTURE.md §4): el resto de funcionalidades y las rutas solo importan este fichero.
export {
	createApp,
	createOperation,
	appAccessOf,
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
export { seedApps } from './seed';
export { appHeadersOf, type AppHeaders } from './contract';
export { APPS_LOG_EVENTS, type AppsLogFields } from './events';

export { totalTimeoutMs, fitWithin, type TimedAttempt } from './domain/total-timeout';
export { CHAT_RETRY_WAITS_MS, operationTotalMs } from './domain/operation-timing';
