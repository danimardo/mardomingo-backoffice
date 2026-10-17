// Valores por defecto de la configuración (data-model.md 3.1; Historias §9) y perfil inicial de `secretario`
// (BE-FR-62, BE-FR-31, BE-FR-39). Es el origen del _seed_ de `apps` y de `payments` (T080).
//
// Modelos, respaldos y topes de `secretario`: aprobados por el propietario el 2026-10-11 (T079, `approvedOperationOf`).
// Las operaciones se siembran inactivas (`active = 0`): las activa el administrador. Una clave ya existente en la BD
// nunca se sobrescribe desde aquí.
import type {
	SettingKey,
	SettingValue,
	SyncSchema,
	AppLinks,
	OperationLimits
} from './json-schemas';
import type { OPERATION_KINDS } from './schema';

export const DEFAULT_SETTINGS = Object.freeze({
	credits_per_eur_purchase: 1000,
	credits_per_eur_usage: 1000,
	fx_usd_eur: 920_000,
	fx_buffer_pct: 30_000,
	fx_stale_alert_days: 3,
	margin_global: 2_000_000,
	provider_fee_pct_openrouter: 55_000,
	provider_fee_pct_mistral: 0,
	// Tarifa de Voxtral por minuto (Mistral, 0,003 USD; anuncio de 4-feb-2026), aprobada el 2026-10-11 (T079).
	voxtral_price_per_minute_usd: 3_000,
	welcome_credits: 1_000_000_000,
	free_credits_expiry_days: 30,
	free_expiry_warning_days: 7,
	min_balance_to_operate: 5_000_000,
	max_debt: 200_000_000,
	hold_ttl_seconds: 600,
	chars_per_token_estimate: 3,
	image_input_token_estimate: 1500,
	idempotency_window_minutes: 10,
	daily_cap_no_purchase: 400_000_000,
	registrations_per_ip_24h: 3,
	login_max_failures: 10,
	login_lock_minutes: 15,
	// Límites por IP (BE-FR-45). Valores provisionales: la especificación no los fija; pendientes de revisión del propietario.
	login_per_ip_15min: 30,
	resend_verification_per_ip_hour: 5,
	password_reset_per_ip_hour: 5,
	unverified_account_ttl_days: 7,
	min_age: 18,
	inactive_account_years: 3,
	inactive_account_notice_days: 30,
	ai_requests_per_minute: 30,
	max_concurrent_transcriptions: 2,
	max_audio_seconds: 300,
	audio_duration_tolerance_seconds: 10,
	max_audio_mb: 10,
	max_text_chars: 200_000,
	max_image_mb: 10,
	max_sync_doc_kb: 1024,
	global_daily_free_cost_brake_eur: 500,
	maintenance: { active: false, message: '' },
	openrouter_balance_alert_usd: 10_000_000,
	model_price_change_alert_pct: 200_000,
	price_reference_window_days: 30,
	price_reference_min_samples: 50,
	flagged_ops_alert_per_day: 3,
	support_email: 'soporte@mardomingo.com'
} satisfies Record<SettingKey, SettingValue>);

/** Paquete de créditos por defecto (BE-FR-23). El bono se expresa en ppm: 5 % → 50.000. */
export interface DefaultPack {
	readonly id: string;
	readonly name: string;
	readonly priceEurCents: number;
	readonly bonusPpm: number;
	readonly sortOrder: number;
}

// Identificadores fijos: así el _seed_ es idempotente (dos ejecuciones dan el mismo resultado).
export const DEFAULT_PACKS: readonly DefaultPack[] = Object.freeze([
	{ id: 'pck_seed_5eur', name: 'Pack 5 €', priceEurCents: 500, bonusPpm: 0, sortOrder: 1 },
	{ id: 'pck_seed_10eur', name: 'Pack 10 €', priceEurCents: 1000, bonusPpm: 50_000, sortOrder: 2 },
	{ id: 'pck_seed_25eur', name: 'Pack 25 €', priceEurCents: 2500, bonusPpm: 100_000, sortOrder: 3 }
]);

/**
 * Enlaces de `secretario`. La descarga apunta a la última release de su repositorio, con un nombre de fichero fijo y sin
 * versión (T079, D-21). Hasta que exista una release con ese nombre, el enlace no resuelve.
 */
export const SECRETARIO_LINKS = Object.freeze({
	landing: { type: 'internal' },
	download_url:
		'https://github.com/danimardo/secretario2/releases/latest/download/SecretarioAI-Setup.exe',
	release_notes_url: null
} satisfies AppLinks);

/** Esquema de sincronización de `secretario` (3.2, BE-FR-39). */
export const SECRETARIO_SYNC_SCHEMA: SyncSchema = Object.freeze({
	categories: {
		customReplacements: { strategy: 'items', key: 'from', tombstone_ttl_days: 30 },
		coreReplacements: { strategy: 'block' },
		quickTexts: { strategy: 'block' },
		prompts: { strategy: 'block' },
		preferences: {
			strategy: 'keyed',
			keys: [
				'communicationStyle',
				'messageType',
				'language',
				'targetPersons',
				'processWithLLM',
				'autoCopy',
				'fixAuto',
				'markdownMode',
				'translationTargetLanguage',
				'themePreference'
			]
		}
	}
});

/** Límites de tamaño del perfil de audio de `secretario` (BE-FR-62; Historias §9). */
export const SECRETARIO_OVERRIDES = Object.freeze({
	max_audio_seconds: 300,
	audio_duration_tolerance_seconds: 10,
	max_audio_mb: 10
});

export type OperationKind = (typeof OPERATION_KINDS)[number];

/**
 * Operaciones de `secretario` (BE-FR-31). Todas libres (`mode = libre`). Modelos, respaldos y topes: `approvedOperationOf` (T079).
 */
export interface DefaultOperation {
	readonly key: string;
	readonly name: string;
	readonly kind: OperationKind;
	readonly groupLabel: string;
	readonly timeoutMs: number;
	readonly capabilities: {
		readonly image_input: boolean;
		readonly structured_output: boolean;
		readonly tools: boolean;
	};
	readonly limits: OperationLimits;
}

const CHAT_CAPABILITIES = Object.freeze({
	image_input: false,
	structured_output: false,
	tools: false
});

export const SECRETARIO_OPERATIONS: readonly DefaultOperation[] = Object.freeze([
	{
		key: 'improve',
		name: 'Procesar',
		kind: 'chat',
		groupLabel: 'Corrector',
		timeoutMs: 45_000,
		capabilities: CHAT_CAPABILITIES,
		limits: {}
	},
	{
		key: 'enhance',
		name: 'Mejorar',
		kind: 'chat',
		groupLabel: 'Corrector',
		timeoutMs: 45_000,
		capabilities: CHAT_CAPABILITIES,
		limits: {}
	},
	{
		key: 'fix',
		name: 'Corregir',
		kind: 'chat',
		groupLabel: 'Corrector',
		timeoutMs: 45_000,
		capabilities: CHAT_CAPABILITIES,
		limits: {}
	},
	{
		key: 'beautify',
		name: 'Embellecer Markdown',
		kind: 'chat',
		groupLabel: 'Corrector',
		timeoutMs: 45_000,
		capabilities: CHAT_CAPABILITIES,
		limits: {}
	},
	{
		key: 'translate',
		name: 'Traducir',
		kind: 'chat',
		groupLabel: 'Corrector',
		timeoutMs: 45_000,
		capabilities: CHAT_CAPABILITIES,
		limits: {}
	},
	{
		key: 'image-transcription',
		name: 'Transcripción de imagen',
		kind: 'chat',
		groupLabel: 'Corrector',
		timeoutMs: 60_000,
		capabilities: { image_input: true, structured_output: false, tools: false },
		limits: {}
	},
	{
		key: 'direct-prompt',
		name: 'Prompt directo',
		kind: 'chat',
		groupLabel: 'PRO',
		timeoutMs: 45_000,
		capabilities: CHAT_CAPABILITIES,
		limits: {}
	},
	{
		key: 'custom-prompt',
		name: 'Prompts personalizados',
		kind: 'chat',
		groupLabel: 'PRO',
		timeoutMs: 45_000,
		capabilities: CHAT_CAPABILITIES,
		limits: {}
	},
	{
		key: 'adhoc-prompt',
		name: 'Prompt ad hoc',
		kind: 'chat',
		groupLabel: 'PRO',
		timeoutMs: 45_000,
		capabilities: CHAT_CAPABILITIES,
		limits: {}
	},
	{
		key: 'transcription',
		name: 'Transcripción de audio',
		kind: 'transcription',
		groupLabel: 'Voxtral + respaldo',
		timeoutMs: 45_000,
		capabilities: CHAT_CAPABILITIES,
		limits: {}
	},
	{
		key: 'image-generation',
		name: 'Generación de imagen',
		kind: 'image',
		groupLabel: 'Modelo de imagen',
		timeoutMs: 60_000,
		capabilities: CHAT_CAPABILITIES,
		limits: {}
	}
] satisfies DefaultOperation[]);

/** Modelo de respaldo de la transcripción, aprobado el 2026-10-11 (T079): el que sugiere el asistente de Secretario. */
export const TRANSCRIPTION_BACKUP_MODEL = 'google/gemini-3.7-flash';

/** Tiempo máximo de cada intento del respaldo de transcripción (ms). */
export const TRANSCRIPTION_BACKUP_TIMEOUT_MS = 60_000;

/**
 * Modelo, respaldos y topes de una operación de `secretario`, aprobados por el propietario el 2026-10-11 (T079). Los
 * precios son los de la API pública de OpenRouter y los del anuncio de Voxtral de Mistral, consultados ese día. El tope
 * es duro (BE-FR-72) y se fija con el peor caso: 8.000 tokens de entrada, `max_output_tokens` y el modelo más caro del
 * grupo (principal o respaldo).
 */
export interface ApprovedOperation {
	readonly model: string | null;
	readonly fallbackModels: readonly string[];
	readonly maxOutputTokens: number | null;
	/** Tope duro en micro-créditos (1 crédito = 1.000.000 µc). */
	readonly maxCostMicro: number;
	/** Coste máximo estimado en micro-USD, cuando el precio por imagen no se conoce. */
	readonly estimatedMaxCostMicroUsd: number | null;
}

const CHAT_MAX_OUTPUT_TOKENS = 8_192;

const CORRECTOR: ApprovedOperation = Object.freeze({
	model: 'anthropic/claude-haiku-5.5',
	fallbackModels: Object.freeze(['openai/gpt-5.6-luna']),
	maxOutputTokens: CHAT_MAX_OUTPUT_TOKENS,
	maxCostMicro: 12_000_000,
	estimatedMaxCostMicroUsd: null
});

const IMAGE_TRANSCRIPTION: ApprovedOperation = Object.freeze({
	model: 'openai/gpt-5.6-luna',
	fallbackModels: Object.freeze(['anthropic/claude-haiku-5.5']),
	maxOutputTokens: CHAT_MAX_OUTPUT_TOKENS,
	maxCostMicro: 12_000_000,
	estimatedMaxCostMicroUsd: null
});

const PRO: ApprovedOperation = Object.freeze({
	model: 'openai/gpt-5.6-sol',
	fallbackModels: Object.freeze(['anthropic/claude-sonnet-5.5']),
	maxOutputTokens: CHAT_MAX_OUTPUT_TOKENS,
	maxCostMicro: 100_000_000,
	estimatedMaxCostMicroUsd: null
});

const TRANSCRIPTION: ApprovedOperation = Object.freeze({
	model: null,
	fallbackModels: Object.freeze([]),
	maxOutputTokens: null,
	maxCostMicro: 25_000_000,
	estimatedMaxCostMicroUsd: null
});

const IMAGE: ApprovedOperation = Object.freeze({
	model: 'google/gemini-3.1-flash-image',
	fallbackModels: Object.freeze([]),
	maxOutputTokens: null,
	// 200 créditos (decisión del propietario, L08): 80 no cubría la estimación de 0,08 USD por imagen (~155 créditos).
	maxCostMicro: 200_000_000,
	estimatedMaxCostMicroUsd: 80_000
});

/** Valores aprobados de una operación de `secretario`, por su clave. Una clave desconocida es un error de programación. */
export function approvedOperationOf(key: string): ApprovedOperation {
	switch (key) {
		case 'improve':
		case 'enhance':
		case 'fix':
		case 'beautify':
		case 'translate':
			return CORRECTOR;
		case 'image-transcription':
			return IMAGE_TRANSCRIPTION;
		case 'direct-prompt':
		case 'custom-prompt':
		case 'adhoc-prompt':
			return PRO;
		case 'transcription':
			return TRANSCRIPTION;
		case 'image-generation':
			return IMAGE;
		default:
			throw new Error(`operación de secretario sin valores aprobados: ${key}`);
	}
}

/** Modelo del primario de transcripción (3.4): «voxtral-mini-latest». Confirmado por la documentación. */
export const TRANSCRIPTION_PRIMARY_MODEL = 'voxtral-mini-latest';
