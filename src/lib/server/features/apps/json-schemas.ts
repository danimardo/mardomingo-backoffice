// Esquemas Zod de las columnas JSON de `apps` (data-model.md 3.1, 3.2, 3.4 y 3.5). Todos los objetos son estrictos:
// una clave desconocida se rechaza. Los tipos de dominio de las columnas `json` salen de aquí (`z.infer`).
import { z } from 'zod';

const hasNoDuplicates = (items: readonly string[]): boolean => new Set(items).size === items.length;

const PositiveInt = z.int().positive();
const NonNegativeInt = z.int().nonnegative();
const Text = z.string().min(1);
const VARIABLE_NAME = /^[a-z][a-z0-9_]*$/;
const PLACEHOLDER = /\{\{([a-z][a-z0-9_]*)\}\}/g;

// Tipos de cliente (3.2): array no vacío y sin repetidos.
export const CLIENT_TYPES = Object.freeze(['desktop', 'web', 'mobile'] as const);
export const ClientTypes = z
	.array(z.enum(CLIENT_TYPES))
	.min(1)
	.refine(hasNoDuplicates, { message: 'client_types no admite repetidos' });
export type ClientTypes = z.infer<typeof ClientTypes>;

// Orígenes CORS (3.2): `https://host[:puerto]`, sin ruta.
const ORIGIN = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*(:[0-9]{1,5})?$/;
export const AllowedOrigins = z
	.array(z.string().regex(ORIGIN, { message: 'origen no válido: https://host[:puerto]' }))
	.refine(hasNoDuplicates, { message: 'allowed_origins no admite repetidos' });
export type AllowedOrigins = z.infer<typeof AllowedOrigins>;

// Enlaces de la app (3.2): landing interna o externa, descarga y notas de versión.
export const AppLinks = z.strictObject({
	landing: z.discriminatedUnion('type', [
		z.strictObject({ type: z.literal('internal') }),
		z.strictObject({ type: z.literal('external'), url: z.url() })
	]),
	download_url: z.url().nullish(),
	release_notes_url: z.url().nullish()
});
export type AppLinks = z.infer<typeof AppLinks>;

// Sobrescrituras por app de las claves «por app» de §9 (3.2). Los topes frente al global se comprueban en `config.ts`.
// Las claves con global llevan tope (D06 = R01); las que no tienen global (max_audio_seconds, audio_duration_tolerance_seconds,
// max_audio_mb, max_sync_doc_kb) no lo llevan hasta que la especificación fije uno.
export const OVERRIDABLE_CEILINGS = Object.freeze([
	'ai_requests_per_minute',
	'max_concurrent_transcriptions',
	'max_text_chars',
	'max_image_mb'
] as const);

export const SettingsOverrides = z.strictObject({
	ai_requests_per_minute: PositiveInt.optional(),
	max_concurrent_transcriptions: PositiveInt.optional(),
	max_audio_seconds: PositiveInt.optional(),
	audio_duration_tolerance_seconds: PositiveInt.optional(),
	max_audio_mb: PositiveInt.optional(),
	max_text_chars: PositiveInt.optional(),
	max_image_mb: PositiveInt.optional(),
	max_sync_doc_kb: PositiveInt.optional()
});
export type SettingsOverrides = z.infer<typeof SettingsOverrides>;

// Esquema de sincronización (3.2): categorías con nombre camelCase y su estrategia.
const CATEGORY_NAME = /^[a-zA-Z][a-zA-Z0-9]*$/;
// `personal: true` marca una categoría con datos personales: la copia a predeterminados la avisa (D14 = R14).
const Personal = z.literal(true).optional();
export const SyncCategory = z.discriminatedUnion('strategy', [
	z.strictObject({
		strategy: z.literal('items'),
		key: Text,
		tombstone_ttl_days: PositiveInt,
		personal: Personal
	}),
	z.strictObject({ strategy: z.literal('block'), personal: Personal }),
	z.strictObject({
		strategy: z.literal('keyed'),
		keys: z
			.array(Text)
			.min(1)
			.refine(hasNoDuplicates, { message: 'keys no admite repetidos' })
			.optional(),
		personal: Personal
	})
]);
export const SyncSchema = z.strictObject({
	categories: z
		.record(z.string().regex(CATEGORY_NAME), SyncCategory)
		.refine((categories) => Object.keys(categories).length > 0, {
			message: 'sync_schema necesita al menos una categoría'
		})
});
export type SyncSchema = z.infer<typeof SyncSchema>;

// Valores de `settings` por clave (3.1). Los importes son enteros: µc, ppm, µUSD o céntimos según la clave.
const Micro = NonNegativeInt;
const Ppm = NonNegativeInt;
const MicroUsd = NonNegativeInt;
const EurCents = NonNegativeInt;
const Maintenance = z.strictObject({ active: z.boolean(), message: z.string() });

export const SETTING_SCHEMAS = Object.freeze({
	credits_per_eur_purchase: PositiveInt,
	credits_per_eur_usage: PositiveInt,
	fx_usd_eur: PositiveInt,
	fx_buffer_pct: Ppm,
	fx_stale_alert_days: PositiveInt,
	margin_global: z.int().min(1_000_000),
	provider_fee_pct_openrouter: Ppm,
	provider_fee_pct_mistral: Ppm,
	voxtral_price_per_minute_usd: MicroUsd,
	welcome_credits: Micro,
	free_credits_expiry_days: PositiveInt,
	free_expiry_warning_days: PositiveInt,
	min_balance_to_operate: Micro,
	max_debt: Micro,
	hold_ttl_seconds: PositiveInt,
	chars_per_token_estimate: PositiveInt,
	image_input_token_estimate: PositiveInt,
	idempotency_window_minutes: PositiveInt,
	daily_cap_no_purchase: Micro,
	registrations_per_ip_24h: PositiveInt,
	login_max_failures: PositiveInt,
	login_lock_minutes: PositiveInt,
	login_per_ip_15min: PositiveInt,
	resend_verification_per_ip_hour: PositiveInt,
	password_reset_per_ip_hour: PositiveInt,
	unverified_account_ttl_days: PositiveInt,
	min_age: PositiveInt,
	inactive_account_years: PositiveInt,
	inactive_account_notice_days: PositiveInt,
	ai_requests_per_minute: PositiveInt,
	max_concurrent_transcriptions: PositiveInt,
	max_audio_seconds: PositiveInt,
	audio_duration_tolerance_seconds: PositiveInt,
	max_audio_mb: PositiveInt,
	max_text_chars: PositiveInt,
	max_image_mb: PositiveInt,
	max_sync_doc_kb: PositiveInt,
	global_daily_free_cost_brake_eur: EurCents,
	maintenance: Maintenance,
	openrouter_balance_alert_usd: MicroUsd,
	model_price_change_alert_pct: Ppm,
	price_reference_window_days: PositiveInt,
	price_reference_min_samples: PositiveInt,
	flagged_ops_alert_per_day: PositiveInt,
	support_email: z.email()
});
export type SettingKey = keyof typeof SETTING_SCHEMAS;
export type SettingValue = z.infer<(typeof SETTING_SCHEMAS)[SettingKey]>;

/** Comprueba en tiempo de ejecución que una cadena es una clave conocida de `settings` (3.1). */
export function isSettingKey(value: string): value is SettingKey {
	return Object.hasOwn(SETTING_SCHEMAS, value);
}

/** Valida el valor de una clave de `settings` con su esquema (3.1). */
export function parseSettingValue(key: SettingKey, value: unknown) {
	return SETTING_SCHEMAS[key].safeParse(value);
}

/**
 * Rangos de los parámetros de protección que fija la administración (D08 = R03 de la propuesta). Solo los aplica el camino
 * de escritura (`parseAdminSettingValue`): la lectura de la BD (`parseSettingValue`) no los exige, así que un valor sembrado
 * fuera de rango (p. ej. la siembra de pruebas E2E) sigue siendo legible.
 */
const ADMIN_SETTING_SCHEMAS = Object.freeze({
	...SETTING_SCHEMAS,
	global_daily_free_cost_brake_eur: z.int().min(100).max(10_000),
	registrations_per_ip_24h: z.int().min(1).max(20),
	login_max_failures: z.int().min(3).max(50),
	login_lock_minutes: z.int().min(1).max(1_440),
	login_per_ip_15min: z.int().min(5).max(500),
	resend_verification_per_ip_hour: z.int().min(1).max(50),
	password_reset_per_ip_hour: z.int().min(1).max(50),
	ai_requests_per_minute: z.int().min(1).max(300),
	max_concurrent_transcriptions: z.int().min(1).max(10)
});

/** Valida un valor que escribe la administración (D08 = R03): el esquema de la clave, con los rangos de protección. */
export function parseAdminSettingValue(key: SettingKey, value: unknown) {
	return ADMIN_SETTING_SCHEMAS[key].safeParse(value);
}

// Operaciones (3.4): modelos de respaldo, capacidades, límites y configuración de transcripción.
export const FallbackModels = z
	.array(Text)
	.refine(hasNoDuplicates, { message: 'fallback_models no admite repetidos' });
export type FallbackModels = z.infer<typeof FallbackModels>;

export const Capabilities = z.strictObject({
	image_input: z.boolean(),
	structured_output: z.boolean(),
	tools: z.boolean()
});
export type Capabilities = z.infer<typeof Capabilities>;

export const OperationLimits = z.strictObject({
	max_text_chars: PositiveInt.optional(),
	max_image_mb: PositiveInt.optional()
});
export type OperationLimits = z.infer<typeof OperationLimits>;

export const TranscriptionConfig = z
	.strictObject({
		primary: z.strictObject({
			enabled: z.boolean(),
			model: Text,
			timeout_ms: PositiveInt,
			retry_delays_ms: z.array(NonNegativeInt)
		}),
		backup: z.strictObject({ model: Text, timeout_ms: PositiveInt }).nullable()
	})
	.refine((config) => config.primary.enabled || config.backup !== null, {
		message: 'con primary.enabled = false, backup no puede ser nulo (BE-FR-35)',
		path: ['backup']
	});
export type TranscriptionConfig = z.infer<typeof TranscriptionConfig>;

// Plantillas (3.5): mensajes, variables, formato de respuesta y herramientas.
export const TemplateVariables = z
	.array(
		z.strictObject({
			name: z.string().regex(VARIABLE_NAME),
			type: z.enum(['text', 'image']),
			required: z.boolean(),
			max_chars: PositiveInt.optional(),
			max_mb: PositiveInt.optional()
		})
	)
	.superRefine((variables, ctx) => {
		const names = variables.map((variable) => variable.name);
		if (!hasNoDuplicates(names)) {
			ctx.addIssue({ code: 'custom', message: 'los nombres de variable no pueden repetirse' });
		}
		variables.forEach((variable, index) => {
			if (variable.type === 'text' && variable.max_mb !== undefined) {
				ctx.addIssue({
					code: 'custom',
					message: 'max_mb solo aplica a variables de imagen',
					path: [index]
				});
			}
			if (variable.type === 'image' && variable.max_chars !== undefined) {
				ctx.addIssue({
					code: 'custom',
					message: 'max_chars solo aplica a variables de texto',
					path: [index]
				});
			}
		});
	});
export type TemplateVariables = z.infer<typeof TemplateVariables>;

const TemplateTextPart = z.strictObject({ type: z.literal('text'), text: z.string() });
const TemplateImagePart = z.strictObject({
	type: z.literal('image_url'),
	variable: z.string().regex(VARIABLE_NAME)
});

export const TemplateMessages = z
	.array(
		z.strictObject({
			role: z.enum(['system', 'user', 'assistant']),
			content: z.union([z.string(), z.array(z.union([TemplateTextPart, TemplateImagePart])).min(1)])
		})
	)
	.min(1);
export type TemplateMessages = z.infer<typeof TemplateMessages>;

export const ResponseFormat = z.strictObject({
	type: z.literal('json_schema'),
	json_schema: z.strictObject({
		name: Text,
		strict: z.boolean().optional(),
		schema: z.record(z.string(), z.unknown())
	})
});
export type ResponseFormat = z.infer<typeof ResponseFormat>;

export const TemplateTools = z.strictObject({
	tools: z.array(
		z.strictObject({
			type: z.literal('function'),
			function: z.strictObject({
				name: Text,
				description: z.string().optional(),
				parameters: z.record(z.string(), z.unknown())
			})
		})
	),
	tool_choice: z
		.union([
			z.enum(['auto', 'none', 'required']),
			z.strictObject({
				type: z.literal('function'),
				function: z.strictObject({ name: Text })
			})
		])
		.optional()
});
export type TemplateTools = z.infer<typeof TemplateTools>;

/**
 * Comprueba que las variables declaradas y las usadas coinciden (3.5): cada `{{nombre}}` de un texto debe ser una
 * variable de texto declarada; cada `image_url` debe apuntar a una variable de imagen; y no sobra ninguna variable.
 * Devuelve los problemas encontrados; lista vacía = coherente.
 */
export function templateVariableIssues(body: {
	readonly messages: TemplateMessages;
	readonly variables: TemplateVariables;
}): string[] {
	const declared = new Map(body.variables.map((variable) => [variable.name, variable.type]));
	const placeholders: string[] = [];
	const imageVariables: string[] = [];

	for (const message of body.messages) {
		const parts =
			typeof message.content === 'string'
				? [{ type: 'text' as const, text: message.content }]
				: message.content;
		for (const part of parts) {
			if (part.type === 'image_url') {
				imageVariables.push(part.variable);
				continue;
			}
			for (const match of part.text.matchAll(PLACEHOLDER)) {
				placeholders.push(match[1] ?? '');
			}
		}
	}

	const issues: string[] = [];
	for (const name of new Set(placeholders)) {
		const type = declared.get(name);
		if (type === undefined) issues.push(`variable usada y no declarada: ${name}`);
		else if (type !== 'text') issues.push(`{{${name}}} apunta a una variable que no es de texto`);
	}
	for (const name of imageVariables) {
		const type = declared.get(name);
		if (type === undefined) issues.push(`imagen con variable no declarada: ${name}`);
		else if (type !== 'image')
			issues.push(`image_url apunta a una variable que no es de imagen: ${name}`);
	}
	for (const [name, type] of declared) {
		const used = type === 'text' ? placeholders.includes(name) : imageVariables.includes(name);
		if (!used) issues.push(`variable declarada y sin uso: ${name}`);
	}
	return issues;
}

export const PromptTemplateBody = z
	.strictObject({
		messages: TemplateMessages,
		variables: TemplateVariables.default([]),
		response_format: ResponseFormat.nullish(),
		tools: TemplateTools.nullish()
	})
	.superRefine((body, ctx) => {
		for (const message of templateVariableIssues(body)) {
			ctx.addIssue({ code: 'custom', message });
		}
	});
export type PromptTemplateBody = z.infer<typeof PromptTemplateBody>;
