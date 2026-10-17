// Valores aprobados de las operaciones de `secretario` (T079, 2026-10-11): cada grupo tiene su modelo, su respaldo y sus
// topes, y ninguna operación repite el modelo principal como respaldo (regla de `operationRuleIssues`).
import { describe, expect, it } from 'vitest';
import { SECRETARIO_OPERATIONS, approvedOperationOf } from './defaults';

describe('approvedOperationOf', () => {
	it('cubre las once operaciones de secretario sin dejar ninguna fuera', () => {
		for (const operation of SECRETARIO_OPERATIONS) {
			expect(() => approvedOperationOf(operation.key)).not.toThrow();
		}
		expect(SECRETARIO_OPERATIONS).toHaveLength(11);
	});

	it('el Corrector usa Haiku con respaldo GPT-5.6 luna y tope de 12 créditos', () => {
		for (const key of ['improve', 'enhance', 'fix', 'beautify', 'translate']) {
			expect(approvedOperationOf(key)).toEqual({
				model: 'anthropic/claude-haiku-5.5',
				fallbackModels: ['openai/gpt-5.6-luna'],
				maxOutputTokens: 8_192,
				maxCostMicro: 12_000_000,
				estimatedMaxCostMicroUsd: null
			});
		}
	});

	it('la transcripción de imagen usa GPT-5.6 luna con respaldo Haiku', () => {
		expect(approvedOperationOf('image-transcription')).toMatchObject({
			model: 'openai/gpt-5.6-luna',
			fallbackModels: ['anthropic/claude-haiku-5.5'],
			maxCostMicro: 12_000_000
		});
	});

	it('los prompts PRO usan GPT-5.6 sol con respaldo Sonnet y tope de 100 créditos', () => {
		for (const key of ['direct-prompt', 'custom-prompt', 'adhoc-prompt']) {
			expect(approvedOperationOf(key)).toMatchObject({
				model: 'openai/gpt-5.6-sol',
				fallbackModels: ['anthropic/claude-sonnet-5.5'],
				maxCostMicro: 100_000_000
			});
		}
	});

	it('la transcripción de audio no fija modelo aquí (lo lleva transcription_config) y tiene tope de 25 créditos', () => {
		expect(approvedOperationOf('transcription')).toMatchObject({
			model: null,
			fallbackModels: [],
			maxCostMicro: 25_000_000
		});
	});

	it('la generación de imagen usa Gemini 3.1 flash image con coste estimado de 0,08 USD', () => {
		expect(approvedOperationOf('image-generation')).toEqual({
			model: 'google/gemini-3.1-flash-image',
			fallbackModels: [],
			maxOutputTokens: null,
			maxCostMicro: 200_000_000,
			estimatedMaxCostMicroUsd: 80_000
		});
	});

	it('ninguna operación repite el modelo principal en sus respaldos', () => {
		for (const operation of SECRETARIO_OPERATIONS) {
			const approved = approvedOperationOf(operation.key);
			expect(approved.model === null || !approved.fallbackModels.includes(approved.model)).toBe(
				true
			);
		}
	});

	it('una clave desconocida es un error de programación', () => {
		expect(() => approvedOperationOf('inventada')).toThrow('sin valores aprobados: inventada');
	});
});
