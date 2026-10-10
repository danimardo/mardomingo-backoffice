import { describe, expect, it } from 'vitest';
import {
	operationRuleIssues,
	overrideCeilingIssues,
	resolveAppSettings,
	resolveMarginPpm,
	resolveOperationLimits,
	type GlobalNumbers,
	type OperationRuleInput
} from './config';
import { DEFAULT_PACKS, DEFAULT_SETTINGS, SECRETARIO_OPERATIONS } from './defaults';
import { SETTING_SCHEMAS, isSettingKey, parseSettingValue } from './json-schemas';

const GLOBALS: GlobalNumbers = Object.freeze({
	ai_requests_per_minute: 30,
	max_concurrent_transcriptions: 2,
	max_audio_seconds: 300,
	audio_duration_tolerance_seconds: 10,
	max_audio_mb: 10,
	max_text_chars: 200_000,
	max_image_mb: 10,
	max_sync_doc_kb: 1024
});

describe('herencia global → app → operación (BE-FR-61 CA2)', () => {
	it('una sobrescritura de la app gana al global; sin ella, se usa el global', () => {
		const effective = resolveAppSettings(GLOBALS, { max_text_chars: 50_000 });

		expect(effective.max_text_chars).toBe(50_000);
		expect(effective.max_image_mb).toBe(10);
	});

	it('los límites de la operación ganan a los de la app; sin ellos, se usan los de la app', () => {
		const app = resolveAppSettings(GLOBALS, { max_image_mb: 4 });

		expect(resolveOperationLimits(app, { max_text_chars: 1_000 })).toEqual({
			max_text_chars: 1_000,
			max_image_mb: 4
		});
		expect(resolveOperationLimits(app, {})).toEqual({ max_text_chars: 200_000, max_image_mb: 4 });
	});

	it('el margen de la operación gana al global; sin él, se usa el global', () => {
		expect(resolveMarginPpm(2_000_000, 1_500_000)).toBe(1_500_000);
		expect(resolveMarginPpm(2_000_000, null)).toBe(2_000_000);
	});
});

describe('topes de las sobrescrituras (BE-FR-61 CA4)', () => {
	it('una app no puede superar el global en las claves con tope', () => {
		expect(overrideCeilingIssues({ ai_requests_per_minute: 31 }, GLOBALS)).toHaveLength(1);
		expect(overrideCeilingIssues({ max_concurrent_transcriptions: 3 }, GLOBALS)).toHaveLength(1);
	});

	it('igualar o quedar por debajo del global es válido', () => {
		expect(overrideCeilingIssues({ ai_requests_per_minute: 30 }, GLOBALS)).toEqual([]);
		expect(overrideCeilingIssues({ max_concurrent_transcriptions: 1 }, GLOBALS)).toEqual([]);
		expect(overrideCeilingIssues({ max_text_chars: 999_999_999 }, GLOBALS)).toEqual([]);
	});
});

const CHAT: OperationRuleInput = {
	kind: 'chat',
	active: false,
	model: null,
	fallbackModels: [],
	maxOutputTokens: 4096,
	transcriptionConfig: null,
	marginOverridePpm: null
};

describe('reglas de coherencia de una operación (BE-FR-61 CA4, BE-FR-77 CA2)', () => {
	it('una operación de chat coherente no tiene problemas', () => {
		expect(operationRuleIssues(CHAT)).toEqual([]);
	});

	it('un chat exige un tope de salida positivo', () => {
		expect(operationRuleIssues({ ...CHAT, maxOutputTokens: null })).toHaveLength(1);
		expect(operationRuleIssues({ ...CHAT, maxOutputTokens: 0 })).toHaveLength(1);
	});

	it('la configuración de transcripción solo existe en las operaciones de transcripción', () => {
		const config = {
			primary: {
				enabled: true,
				model: 'voxtral-mini-latest',
				timeout_ms: 45_000,
				retry_delays_ms: []
			},
			backup: null
		};
		expect(operationRuleIssues({ ...CHAT, transcriptionConfig: config })).toHaveLength(1);
		const transcription: OperationRuleInput = {
			...CHAT,
			kind: 'transcription',
			maxOutputTokens: null
		};
		expect(operationRuleIssues(transcription)).toHaveLength(1);
		expect(operationRuleIssues({ ...transcription, transcriptionConfig: config })).toEqual([]);
	});

	it('una operación activa necesita modelo, salvo la transcripción', () => {
		expect(operationRuleIssues({ ...CHAT, active: true })).toHaveLength(1);
		expect(operationRuleIssues({ ...CHAT, active: true, model: 'modelo-x' })).toEqual([]);
	});

	it('los respaldos no repiten el modelo principal', () => {
		const issues = operationRuleIssues({ ...CHAT, model: 'a', fallbackModels: ['a'] });
		expect(issues).toHaveLength(1);
	});

	it('el margen mínimo es 1,0 (1.000.000 ppm)', () => {
		expect(operationRuleIssues({ ...CHAT, marginOverridePpm: 999_999 })).toHaveLength(1);
		expect(operationRuleIssues({ ...CHAT, marginOverridePpm: 1_000_000 })).toEqual([]);
	});
});

describe('valores por defecto (T081: mostrables y válidos)', () => {
	it('cada parámetro por defecto valida con su esquema', () => {
		for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
			expect(isSettingKey(key), key).toBe(true);
			if (isSettingKey(key)) expect(parseSettingValue(key, value).success, key).toBe(true);
		}
	});

	it('los valores por defecto cubren exactamente las claves de §9', () => {
		expect(Object.keys(DEFAULT_SETTINGS).sort()).toEqual(Object.keys(SETTING_SCHEMAS).sort());
	});

	it('las once operaciones de secretario cumplen las reglas de coherencia con sus valores sembrados', () => {
		expect(SECRETARIO_OPERATIONS).toHaveLength(11);
		for (const operation of SECRETARIO_OPERATIONS) {
			const issues = operationRuleIssues({
				kind: operation.kind,
				active: false,
				model: null,
				fallbackModels: [],
				maxOutputTokens: operation.kind === 'chat' ? 4096 : null,
				transcriptionConfig:
					operation.kind === 'transcription'
						? {
								primary: {
									enabled: true,
									model: 'voxtral-mini-latest',
									timeout_ms: 45_000,
									retry_delays_ms: []
								},
								backup: null
							}
						: null,
				marginOverridePpm: null
			});
			expect(issues, operation.key).toEqual([]);
		}
	});

	it('los paquetes siguen la tabla de §3: 5 € +0 %, 10 € +5 % (50.000 ppm), 25 € +10 % (100.000 ppm)', () => {
		expect(DEFAULT_PACKS.map((pack) => [pack.priceEurCents, pack.bonusPpm])).toEqual([
			[500, 0],
			[1000, 50_000],
			[2500, 100_000]
		]);
	});
});
