// Reglas de activación de operaciones (W41; BE-FR-77 CA1–CA3; T311): cada rechazo y la aceptación.
import { describe, expect, it } from 'vitest';
import { checkActivation, type ActivationNeeds, type CatalogEntry } from './activation';

const NONE = { image_input: false, structured_output: false, tools: false };
const chat = (overrides: Partial<ActivationNeeds> = {}): ActivationNeeds => ({
	kind: 'chat',
	model: 'proveedor/modelo',
	capabilities: NONE,
	estimatedMaxCostMicroUsd: null,
	...overrides
});
const catalog = (overrides: Partial<CatalogEntry> = {}): CatalogEntry => ({
	modalities: ['text'],
	supportedParameters: [],
	hasPrice: true,
	...overrides
});

describe('checkActivation (W41)', () => {
	it('rechaza una operación de chat sin modelo', () => {
		expect(checkActivation(chat({ model: null }), catalog())).toEqual({
			ok: false,
			reason: 'no_model'
		});
	});

	it('rechaza un modelo que no está en el catálogo guardado', () => {
		expect(checkActivation(chat(), null)).toEqual({ ok: false, reason: 'model_unknown' });
	});

	it('rechaza un modelo incapaz de la imagen de entrada', () => {
		const needs = chat({ capabilities: { ...NONE, image_input: true } });
		expect(checkActivation(needs, catalog({ modalities: ['text'] }))).toEqual({
			ok: false,
			reason: 'model_incapable'
		});
	});

	it('rechaza un modelo sin salida estructurada o sin herramientas cuando se piden', () => {
		const structured = chat({ capabilities: { ...NONE, structured_output: true } });
		const tools = chat({ capabilities: { ...NONE, tools: true } });
		expect(checkActivation(structured, catalog()).ok).toBe(false);
		expect(checkActivation(tools, catalog()).ok).toBe(false);
		expect(
			checkActivation(structured, catalog({ supportedParameters: ['response_format'] })).ok
		).toBe(true);
		expect(checkActivation(tools, catalog({ supportedParameters: ['tools'] })).ok).toBe(true);
	});

	it('rechaza sin precio del catálogo y sin coste máximo estimado', () => {
		expect(checkActivation(chat(), catalog({ hasPrice: false }))).toEqual({
			ok: false,
			reason: 'no_price'
		});
	});

	it('acepta con coste máximo estimado aunque el catálogo no tenga precio', () => {
		expect(
			checkActivation(chat({ estimatedMaxCostMicroUsd: 5000 }), catalog({ hasPrice: false }))
		).toEqual({ ok: true });
	});

	it('acepta una operación de chat completa con modelo capaz y precio', () => {
		const needs = chat({
			capabilities: { image_input: true, structured_output: false, tools: false }
		});
		expect(checkActivation(needs, catalog({ modalities: ['text', 'image'] }))).toEqual({
			ok: true
		});
	});

	it('la transcripción no exige modelo de chat', () => {
		expect(checkActivation({ ...chat({ model: null }), kind: 'transcription' }, null)).toEqual({
			ok: true
		});
	});
});
