// Vigilancia de modelos asignados contra SQLite real y el doble de OpenRouter (BE-FR-80, US12 escenario 3; T335): un modelo
// asignado que desaparece avisa una vez y se rearma al volver; un precio que cambia más del 20 % avisa una vez por cruce.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ModelCatalogEntry } from '$lib/server/adapters/openrouter/gateway';
import { assignedModelsOf } from '$lib/server/features/apps';
import { activeAlerts } from '$lib/server/features/notifications';
import { chatFixture, type ChatFixture } from '../../../../../tests/builders/chat';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import { refreshModelCache } from './service';

let f: ChatFixture;
let modelId: string;

function entry(overrides: Partial<ModelCatalogEntry> = {}): ModelCatalogEntry {
	return {
		id: modelId,
		inputPerMTokMicroUsd: 1_000_000,
		outputPerMTokMicroUsd: 2_000_000,
		inputModalities: ['text', 'image'],
		outputModalities: ['text'],
		supportedParameters: ['response_format', 'tools'],
		...overrides
	};
}

function alertKeysNow(): string[] {
	return activeAlerts(f.base.db).map((alert) => alert.key);
}

beforeEach(() => {
	f = chatFixture();
	const assigned = assignedModelsOf(f.base.db);
	modelId = assigned[0]?.modelId ?? 'vendor/chat';
});

afterEach(() => {
	f.close();
});

describe('vigilancia de modelos asignados (T335)', () => {
	it('un modelo que desaparece del catálogo avisa una sola vez y se rearma al volver', async () => {
		f.gateway.setModels([entry()]);
		expect(await refreshModelCache(f.deps)).toBe('refreshed');
		expect(alertKeysNow()).toEqual([]);

		f.gateway.setModels([]);
		await refreshModelCache(f.deps);
		await refreshModelCache(f.deps);
		expect(alertKeysNow()).toEqual([`model:${modelId}:retired`]);
		expect(f.sender.sent).toHaveLength(1);
		expect(eventsNamed(f.base.logger, 'ai.model.retired')).toHaveLength(2);

		f.gateway.setModels([entry()]);
		await refreshModelCache(f.deps);
		expect(alertKeysNow()).toEqual([]);
	});

	it('un precio que cambia más del 20 % avisa una vez por cambio; el siguiente refresco sin cambio lo rearma', async () => {
		f.gateway.setModels([entry()]);
		await refreshModelCache(f.deps);

		f.gateway.setModels([entry({ inputPerMTokMicroUsd: 1_100_000 })]);
		await refreshModelCache(f.deps);
		expect(alertKeysNow()).toEqual([]);

		f.gateway.setModels([entry({ inputPerMTokMicroUsd: 1_500_000 })]);
		await refreshModelCache(f.deps);
		await refreshModelCache(f.deps);
		expect(alertKeysNow()).toEqual([]);
		expect(f.sender.sent).toHaveLength(1);
		expect(eventsNamed(f.base.logger, 'ai.model.price_changed')).toHaveLength(1);

		f.gateway.setModels([entry({ inputPerMTokMicroUsd: 1_000_000 })]);
		await refreshModelCache(f.deps);
		expect(f.sender.sent).toHaveLength(2);
		expect(eventsNamed(f.base.logger, 'ai.model.price_changed')).toHaveLength(2);
	});

	it('si el proveedor no responde, el catálogo y las alertas no cambian', async () => {
		f.gateway.setModels([entry()]);
		await refreshModelCache(f.deps);
		f.gateway.setModels(null);

		expect(await refreshModelCache(f.deps)).toBe('unavailable');
		expect(alertKeysNow()).toEqual([]);
	});
});
