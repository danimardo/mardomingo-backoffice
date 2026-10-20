// T-UNIT de la vigilancia de modelos asignados (T335): retirado, incapaz o desaparecido; precio cambiado por encima del umbral;
// y nada cuando el cambio queda dentro del umbral o no hay lectura anterior.
import { describe, expect, it } from 'vitest';
import { detectAssignedModelIssues, priceChangePpm, type AssignedModel } from './model-watch';

const CHAT: AssignedModel = {
	modelId: 'vendor/chat',
	needs: { image_input: false, structured_output: true, tools: false }
};
const PRICE = { inputPerMTokMicroUsd: 1_000_000, outputPerMTokMicroUsd: 2_000_000 };
const FULL_CATALOG = {
	modalities: ['text'],
	supportedParameters: ['response_format'],
	hasPrice: true
};

describe('priceChangePpm', () => {
	it('mide la mayor variación de entrada o salida en ppm', () => {
		expect(priceChangePpm(PRICE, PRICE)).toBe(0);
		expect(
			priceChangePpm(PRICE, { inputPerMTokMicroUsd: 1_300_000, outputPerMTokMicroUsd: 2_000_000 })
		).toBe(300_000);
	});

	it('un precio anterior en cero: sigue en cero no cambia, y pasar a un precio sí', () => {
		const zero = { inputPerMTokMicroUsd: 0, outputPerMTokMicroUsd: 0 };
		expect(priceChangePpm(zero, zero)).toBe(0);
		expect(priceChangePpm(zero, PRICE)).toBeGreaterThan(200_000);
	});
});

describe('detectAssignedModelIssues', () => {
	it('un modelo que pierde imagen o herramientas, que la operación usa, es retirado', () => {
		const image: AssignedModel = {
			modelId: 'vendor/vision',
			needs: { image_input: true, structured_output: false, tools: false }
		};
		const tools: AssignedModel = {
			modelId: 'vendor/tools',
			needs: { image_input: false, structured_output: false, tools: true }
		};
		const current = new Map([
			['vendor/vision', { catalog: FULL_CATALOG, price: PRICE }],
			['vendor/tools', { catalog: FULL_CATALOG, price: PRICE }]
		]);
		expect(
			detectAssignedModelIssues({
				assigned: [image, tools],
				current,
				previous: new Map(),
				thresholdPpm: 200_000
			})
		).toEqual([
			{ kind: 'retired', modelId: 'vendor/vision' },
			{ kind: 'retired', modelId: 'vendor/tools' }
		]);
	});

	it('un modelo que ya no está en el catálogo es retirado', () => {
		expect(
			detectAssignedModelIssues({
				assigned: [CHAT],
				current: new Map(),
				previous: new Map([[CHAT.modelId, PRICE]]),
				thresholdPpm: 200_000
			})
		).toEqual([{ kind: 'retired', modelId: 'vendor/chat' }]);
	});

	it('un modelo que deja de admitir lo que la operación necesita es retirado', () => {
		expect(
			detectAssignedModelIssues({
				assigned: [CHAT],
				current: new Map([
					[CHAT.modelId, { catalog: { ...FULL_CATALOG, supportedParameters: [] }, price: PRICE }]
				]),
				previous: new Map(),
				thresholdPpm: 200_000
			})
		).toEqual([{ kind: 'retired', modelId: 'vendor/chat' }]);
	});

	it('un precio que cambia más del umbral se reporta con su variación', () => {
		expect(
			detectAssignedModelIssues({
				assigned: [CHAT],
				current: new Map([
					[
						CHAT.modelId,
						{
							catalog: FULL_CATALOG,
							price: { inputPerMTokMicroUsd: 1_500_000, outputPerMTokMicroUsd: 2_000_000 }
						}
					]
				]),
				previous: new Map([[CHAT.modelId, PRICE]]),
				thresholdPpm: 200_000
			})
		).toEqual([{ kind: 'price_changed', modelId: 'vendor/chat', changePpm: 500_000 }]);
	});

	it('un modelo asignado sin catálogo nuevo y sin lectura anterior no se compara por precio', () => {
		expect(
			detectAssignedModelIssues({
				assigned: [CHAT],
				current: new Map([[CHAT.modelId, { catalog: FULL_CATALOG, price: PRICE }]]),
				previous: new Map(),
				thresholdPpm: 200_000
			})
		).toEqual([]);
	});

	it('un cambio dentro del umbral, o sin lectura anterior, no genera nada', () => {
		const current = new Map([
			[
				CHAT.modelId,
				{
					catalog: FULL_CATALOG,
					price: { inputPerMTokMicroUsd: 1_100_000, outputPerMTokMicroUsd: 2_000_000 }
				}
			]
		]);
		expect(
			detectAssignedModelIssues({
				assigned: [CHAT],
				current,
				previous: new Map([[CHAT.modelId, PRICE]]),
				thresholdPpm: 200_000
			})
		).toEqual([]);
		expect(
			detectAssignedModelIssues({
				assigned: [CHAT],
				current,
				previous: new Map(),
				thresholdPpm: 200_000
			})
		).toEqual([]);
	});
});
