// API pública de `apps` (ARCHITECTURE.md §4): el resto de funcionalidades y las rutas solo importan este fichero.
export {
	createApp,
	createOperation,
	createTemplateVersion,
	getEffectiveConfig,
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
export { APPS_LOG_EVENTS, type AppsLogFields } from './events';
