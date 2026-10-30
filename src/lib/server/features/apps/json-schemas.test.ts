import { describe, expect, it } from 'vitest';
import {
	AllowedOrigins,
	AppLinks,
	ClientTypes,
	PromptTemplateBody,
	SETTING_SCHEMAS,
	SettingsOverrides,
	SyncSchema,
	TemplateMessages,
	TemplateVariables,
	TranscriptionConfig,
	parseSettingValue,
	templateVariableIssues
} from './json-schemas';

const SECRETARIO_SYNC = {
	categories: {
		customReplacements: { strategy: 'items', key: 'from', tombstone_ttl_days: 30 },
		coreReplacements: { strategy: 'block' },
		quickTexts: { strategy: 'block' },
		prompts: { strategy: 'block' },
		preferences: {
			strategy: 'keyed',
			keys: ['communicationStyle', 'messageType', 'language', 'targetPersons', 'processWithLLM']
		}
	}
};

describe('tipos de cliente y orígenes (3.2)', () => {
	it('acepta un tipo de cliente y rechaza una lista vacía o repetida', () => {
		expect(ClientTypes.safeParse(['desktop']).success).toBe(true);
		expect(ClientTypes.safeParse([]).success).toBe(false);
		expect(ClientTypes.safeParse(['desktop', 'desktop']).success).toBe(false);
		expect(ClientTypes.safeParse(['tv']).success).toBe(false);
	});

	it('acepta solo orígenes https sin ruta', () => {
		expect(AllowedOrigins.safeParse(['https://cuenta.mardomingo.com:8443']).success).toBe(true);
		expect(AllowedOrigins.safeParse(['http://cuenta.mardomingo.com']).success).toBe(false);
		expect(AllowedOrigins.safeParse(['https://cuenta.mardomingo.com/ruta']).success).toBe(false);
	});
});

describe('enlaces de la app (3.2)', () => {
	it('acepta una landing interna y rechaza claves desconocidas', () => {
		expect(AppLinks.safeParse({ landing: { type: 'internal' } }).success).toBe(true);
		expect(AppLinks.safeParse({ landing: { type: 'internal' }, extra: 1 }).success).toBe(false);
	});
});

describe('sobrescrituras y sincronización (3.2)', () => {
	it('solo admite claves «por app» y enteros positivos', () => {
		expect(SettingsOverrides.safeParse({ ai_requests_per_minute: 10 }).success).toBe(true);
		expect(SettingsOverrides.safeParse({ ai_requests_per_minute: 0 }).success).toBe(false);
		expect(SettingsOverrides.safeParse({ margin_global: 2_000_000 }).success).toBe(false);
	});

	it('acepta el perfil de sincronización de secretario y rechaza esquemas vacíos o incompletos', () => {
		expect(SyncSchema.safeParse(SECRETARIO_SYNC).success).toBe(true);
		expect(SyncSchema.safeParse({ categories: {} }).success).toBe(false);
		expect(
			SyncSchema.safeParse({ categories: { customReplacements: { strategy: 'items' } } }).success
		).toBe(false);
	});

	it('marca categorías personales con `personal: true` y rechaza otros valores (D14)', () => {
		const withPersonal = (personal: unknown) => ({
			categories: { prompts: { strategy: 'block', personal } }
		});

		expect(SyncSchema.safeParse(withPersonal(true)).success).toBe(true);
		expect(SyncSchema.safeParse(withPersonal(false)).success).toBe(false);
		expect(SyncSchema.safeParse(withPersonal('si')).success).toBe(false);
		expect(SyncSchema.safeParse({ categories: { prompts: { strategy: 'block' } } }).success).toBe(
			true
		);
	});
});

describe('configuración de transcripción (3.4, BE-FR-35)', () => {
	const primary = {
		enabled: true,
		model: 'voxtral-mini-latest',
		timeout_ms: 45_000,
		retry_delays_ms: [2000]
	};

	it('sin primario activo exige un respaldo', () => {
		expect(TranscriptionConfig.safeParse({ primary, backup: null }).success).toBe(true);
		const disabled = { ...primary, enabled: false };
		expect(TranscriptionConfig.safeParse({ primary: disabled, backup: null }).success).toBe(false);
		const backup = { model: 'otro-modelo', timeout_ms: 60_000 };
		expect(TranscriptionConfig.safeParse({ primary: disabled, backup }).success).toBe(true);
	});
});

describe('variables de plantilla (3.5)', () => {
	it('rechaza nombres repetidos y límites que no corresponden al tipo', () => {
		const repeated = [
			{ name: 'texto', type: 'text', required: true },
			{ name: 'texto', type: 'text', required: false }
		];
		expect(TemplateVariables.safeParse(repeated).success).toBe(false);
		const imageWithChars = [{ name: 'foto', type: 'image', required: true, max_chars: 10 }];
		expect(TemplateVariables.safeParse(imageWithChars).success).toBe(false);
		const textWithMb = [{ name: 'texto', type: 'text', required: true, max_mb: 2 }];
		expect(TemplateVariables.safeParse(textWithMb).success).toBe(false);
	});

	it('detecta variables usadas sin declarar, declaradas sin uso y tipos cruzados', () => {
		const variables: TemplateVariables = [
			{ name: 'texto', type: 'text', required: true },
			{ name: 'foto', type: 'image', required: true },
			{ name: 'sobra', type: 'text', required: false }
		];
		const messages: TemplateMessages = [
			{ role: 'user', content: 'Corrige {{texto}} y {{inexistente}}' },
			{ role: 'user', content: [{ type: 'image_url', variable: 'texto' }] }
		];
		const issues = templateVariableIssues({ messages, variables });

		expect(issues).toContain('variable usada y no declarada: inexistente');
		expect(issues).toContain('image_url apunta a una variable que no es de imagen: texto');
		expect(issues).toContain('variable declarada y sin uso: sobra');
		expect(issues).toContain('variable declarada y sin uso: foto');
	});

	it('una plantilla coherente pasa la validación completa', () => {
		const body = {
			messages: [{ role: 'system' as const, content: 'Eres un corrector.' }],
			variables: []
		};
		expect(PromptTemplateBody.safeParse(body).success).toBe(true);
		const withVariable = {
			messages: [{ role: 'user' as const, content: '{{texto}}' }],
			variables: []
		};
		expect(PromptTemplateBody.safeParse(withVariable).success).toBe(false);
	});
});

describe('valores de settings (3.1)', () => {
	it('valida cada clave con su tipo y su rango', () => {
		expect(parseSettingValue('margin_global', 2_000_000).success).toBe(true);
		expect(parseSettingValue('margin_global', 999_999).success).toBe(false);
		expect(parseSettingValue('min_age', 0).success).toBe(false);
		expect(parseSettingValue('support_email', 'soporte@mardomingo.com').success).toBe(true);
		expect(parseSettingValue('support_email', 'no-es-un-email').success).toBe(false);
		expect(parseSettingValue('maintenance', { active: false, message: '' }).success).toBe(true);
	});

	it('define un esquema para las 45 claves de §9 (42 + 3 límites por IP provisionales, T204)', () => {
		expect(Object.keys(SETTING_SCHEMAS)).toHaveLength(45);
	});
});
