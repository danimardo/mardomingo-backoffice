// Configuración efectiva de cada app (BE-FR-61 CA2): herencia global → app → operación, y las validaciones de
// coherencia que el servicio aplica antes de guardar (BE-FR-61 CA4). Funciones puras: sin I/O ni estado.
import type { OperationLimits, SettingsOverrides, TranscriptionConfig } from './json-schemas';
import { OVERRIDABLE_CEILINGS } from './json-schemas';

/** Claves de `settings` que una app puede sobrescribir (data-model 3.2). */
export const APP_OVERRIDABLE_KEYS = Object.freeze([
	'ai_requests_per_minute',
	'max_concurrent_transcriptions',
	'max_audio_seconds',
	'audio_duration_tolerance_seconds',
	'max_audio_mb',
	'max_text_chars',
	'max_image_mb',
	'max_sync_doc_kb'
] as const);

/** Valores globales numéricos de las claves sobrescribibles. */
export interface GlobalNumbers {
	readonly ai_requests_per_minute: number;
	readonly max_concurrent_transcriptions: number;
	readonly max_audio_seconds: number;
	readonly audio_duration_tolerance_seconds: number;
	readonly max_audio_mb: number;
	readonly max_text_chars: number;
	readonly max_image_mb: number;
	readonly max_sync_doc_kb: number;
}

/** Valores efectivos de una app: sobrescritura de la app o, si no hay, el global. */
export type AppSettings = GlobalNumbers;

/** Margen mínimo: 1,0 en ppm (un margen por debajo de 1 cobraría menos que el coste). */
export const MIN_MARGIN_PPM = 1_000_000;

export function resolveAppSettings(
	globals: GlobalNumbers,
	overrides: SettingsOverrides
): AppSettings {
	return {
		ai_requests_per_minute: overrides.ai_requests_per_minute ?? globals.ai_requests_per_minute,
		max_concurrent_transcriptions:
			overrides.max_concurrent_transcriptions ?? globals.max_concurrent_transcriptions,
		max_audio_seconds: overrides.max_audio_seconds ?? globals.max_audio_seconds,
		audio_duration_tolerance_seconds:
			overrides.audio_duration_tolerance_seconds ?? globals.audio_duration_tolerance_seconds,
		max_audio_mb: overrides.max_audio_mb ?? globals.max_audio_mb,
		max_text_chars: overrides.max_text_chars ?? globals.max_text_chars,
		max_image_mb: overrides.max_image_mb ?? globals.max_image_mb,
		max_sync_doc_kb: overrides.max_sync_doc_kb ?? globals.max_sync_doc_kb
	};
}

/** Límites de una operación: su sobrescritura, o los de la app. */
export function resolveOperationLimits(
	app: Pick<AppSettings, 'max_text_chars' | 'max_image_mb'>,
	operation: OperationLimits
): { readonly max_text_chars: number; readonly max_image_mb: number } {
	return {
		max_text_chars: operation.max_text_chars ?? app.max_text_chars,
		max_image_mb: operation.max_image_mb ?? app.max_image_mb
	};
}

/** Margen efectivo de una operación: su `margin_override_ppm` o el `margin_global`. */
export function resolveMarginPpm(
	globalMarginPpm: number,
	operationOverridePpm: number | null
): number {
	return operationOverridePpm ?? globalMarginPpm;
}

/** Claves con tope frente al global (D06 = R01). */
export type CeilingKey = (typeof OVERRIDABLE_CEILINGS)[number];

/**
 * Una app cuya sobrescritura impide bajar un global (D07 = R02): la administración ve qué app y qué valor hay que cambiar antes.
 */
export interface CeilingConflict {
	readonly appId: string;
	readonly appSlug: string;
	readonly appName: string;
	readonly key: CeilingKey;
	readonly override: number;
	readonly global: number;
}

function isCeilingConflict(value: unknown): value is CeilingConflict {
	return (
		typeof value === 'object' &&
		value !== null &&
		'appId' in value &&
		typeof value.appId === 'string' &&
		'appSlug' in value &&
		typeof value.appSlug === 'string' &&
		'appName' in value &&
		typeof value.appName === 'string' &&
		'key' in value &&
		typeof value.key === 'string' &&
		'override' in value &&
		typeof value.override === 'number' &&
		'global' in value &&
		typeof value.global === 'number'
	);
}

/** Conflictos de un error de `updateSetting` (`details.conflicts`); lista vacía si no los trae o no tienen esa forma. */
export function ceilingConflictsOf(details: Readonly<Record<string, unknown>>): CeilingConflict[] {
	const conflicts = details.conflicts;
	if (!Array.isArray(conflicts)) return [];
	return conflicts.filter(isCeilingConflict);
}

/** Topes de las sobrescrituras frente al global (3.2): una app no puede superar el global. */
export function overrideCeilingIssues(
	overrides: SettingsOverrides,
	globals: Pick<GlobalNumbers, (typeof OVERRIDABLE_CEILINGS)[number]>
): string[] {
	const issues: string[] = [];
	for (const key of OVERRIDABLE_CEILINGS) {
		const value = overrides[key];
		if (value !== undefined && value > globals[key]) {
			issues.push(`${key} por app (${String(value)}) supera el global (${String(globals[key])})`);
		}
	}
	return issues;
}

/** Datos de una operación necesarios para comprobar su coherencia (BE-FR-61 CA4, BE-FR-35, BE-FR-72). */
export interface OperationRuleInput {
	readonly kind: 'chat' | 'transcription' | 'image';
	readonly active: boolean;
	readonly model: string | null;
	readonly fallbackModels: readonly string[];
	readonly maxOutputTokens: number | null;
	readonly transcriptionConfig: TranscriptionConfig | null;
	readonly marginOverridePpm: number | null;
}

/**
 * Reglas de coherencia de una operación que no dependen del catálogo de modelos. Las que sí dependen de
 * `model_cache` (capacidades, precio conocido) son del servicio de `ai`, no de este módulo.
 */
export function operationRuleIssues(operation: OperationRuleInput): string[] {
	const issues: string[] = [];
	if (
		operation.kind === 'chat' &&
		(operation.maxOutputTokens === null || operation.maxOutputTokens <= 0)
	) {
		issues.push('una operación de chat exige max_output_tokens mayor que 0');
	}
	if ((operation.kind === 'transcription') !== (operation.transcriptionConfig !== null)) {
		issues.push('transcription_config solo puede existir en las operaciones de transcripción');
	}
	if (operation.active && operation.kind !== 'transcription' && operation.model === null) {
		issues.push('una operación activa necesita un modelo principal');
	}
	if (operation.model !== null && operation.fallbackModels.includes(operation.model)) {
		issues.push('fallback_models no puede repetir el modelo principal');
	}
	if (operation.marginOverridePpm !== null && operation.marginOverridePpm < MIN_MARGIN_PPM) {
		issues.push('el margen de la operación debe ser de al menos 1,0 (1.000.000 ppm)');
	}
	return issues;
}
