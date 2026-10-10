// Valores por defecto de la configuración (data-model.md 3.1; Historias §9) y perfil inicial de `secretario`
// (BE-FR-62, BE-FR-31, BE-FR-39). Es el origen del _seed_ de `apps` y de `payments` (T080).
//
// PROVISIONAL (T079): los valores marcados así no los fija la documentación y los debe dar el propietario. El
// _seed_ los escribe como provisionales, y las operaciones de `secretario` quedan inactivas (`active = 0`) hasta
// que se sustituyan. Una clave ya existente en la BD nunca se sobrescribe desde aquí.
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
	// PROVISIONAL (T079): «tarifa vigente» de Voxtral sin confirmar; las operaciones de transcripción están inactivas.
	voxtral_price_per_minute_usd: 0,
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

/** Enlaces de `secretario`. La URL de descarga es PROVISIONAL (D-21): sin ella no hay botón de descarga. */
export const SECRETARIO_LINKS = Object.freeze({
	landing: { type: 'internal' },
	download_url: null,
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
 * Operaciones de `secretario` (BE-FR-31). Todas libres (`mode = libre`). Los campos marcados como PROVISIONAL en el
 * _seed_ (`max_output_tokens`, `max_cost_micro`, modelo y respaldo) no los fija la documentación (T079).
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

/** Tope de salida de las operaciones de chat, PROVISIONAL (T079). */
export const PROVISIONAL_CHAT_MAX_OUTPUT_TOKENS = 4096;

/** Tope de coste en µc de las operaciones de chat, PROVISIONAL (T079): 1 crédito. */
export const PROVISIONAL_CHAT_MAX_COST_MICRO = 1_000_000;

/** Tope de coste en µc de la transcripción, PROVISIONAL (T079): 5 créditos. */
export const PROVISIONAL_TRANSCRIPTION_MAX_COST_MICRO = 5_000_000;

/** Tope de coste en µc de la generación de imagen, PROVISIONAL (T079): 10 créditos. */
export const PROVISIONAL_IMAGE_MAX_COST_MICRO = 10_000_000;

/** Modelo del primario de transcripción (3.4): «voxtral-mini-latest». Confirmado por la documentación. */
export const TRANSCRIPTION_PRIMARY_MODEL = 'voxtral-mini-latest';
