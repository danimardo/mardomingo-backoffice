// Tareas de estadísticas contra SQLite real (L14; BE-FR-54, BE-FR-73): las descargas se guardan con su diferencia respecto al
// día anterior, un repositorio que falla no impide los demás ni la tarea, repetir el mismo día no duplica nada y el precio de
// referencia respeta el valor manual.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import {
	addOperation,
	addSecondApp,
	appsTestContext,
	chatOperation
} from '../../../../../tests/builders/apps';
import { savePriceReference } from '../pricing';
import { priceReferences } from '../pricing/schema';
import { releaseDownloads } from './schema';
import { runDownloads, runPrices, type StatsTasksDeps } from './job';

const DAY = 24 * 60 * 60 * 1000;
let f: CreditsFixture;
let releases: number[];
let failFetch: boolean;

function deps(overrides: Partial<StatsTasksDeps> = {}): StatsTasksDeps {
	return {
		db: f.db,
		logger: f.logger,
		clock: f.clock,
		releaseSources: [{ slug: 'secretario', repo: 'danimardo/secretario2' }],
		appIdOfSlug: (slug) => (slug === 'secretario' ? SEEDED_APP_ID : null),
		fetchReleases: () => {
			if (failFetch) return Promise.reject(new Error('GitHub caído'));
			return Promise.resolve([{ assets: releases.map((count) => ({ download_count: count })) }]);
		},
		priceSamples: () => [],
		manualPriceOf: () => null,
		savePriceReference: (input) => {
			savePriceReference({ db: f.db }, input);
		},
		priceWindowDays: () => 30,
		priceMinSamples: () => 3,
		...overrides
	};
}

beforeEach(() => {
	f = creditsFixture(Date.UTC(2026, 9, 17, 9, 0, 0));
	releases = [100];
	failFetch = false;
});

afterEach(() => {
	f.close();
});

describe('descargas de los instaladores (BE-FR-54)', () => {
	it('guardan el acumulado y la diferencia con el día anterior; el primer día no tiene diferencia', async () => {
		await runDownloads(deps());
		f.clock.advance(DAY);
		releases = [130];
		await runDownloads(deps());

		const rows = f.db
			.select()
			.from(releaseDownloads)
			.where(eq(releaseDownloads.appId, SEEDED_APP_ID))
			.all();
		expect(rows.map((row) => [row.cumulativeDownloads, row.downloads])).toEqual([
			[100, null],
			[130, 30]
		]);
	});

	it('repetir la tarea el mismo día no duplica ni cambia la fila', async () => {
		expect(await runDownloads(deps())).toBe(1);
		releases = [999];
		expect(await runDownloads(deps())).toBe(1);

		const rows = f.db.select().from(releaseDownloads).all();
		expect(rows).toHaveLength(1);
		expect(rows[0]?.cumulativeDownloads).toBe(100);
		expect(eventsNamed(f.logger, 'stats.downloads.fetched').map((event) => event.fields)).toEqual([
			{ provider: 'github', count: 1 },
			{ provider: 'github', count: 1 }
		]);
	});

	it('si GitHub falla, se registra, no se guarda nada y la tarea no lanza', async () => {
		failFetch = true;

		expect(await runDownloads(deps())).toBe(0);

		expect(eventsNamed(f.logger, 'stats.downloads.fetch_failed')).toHaveLength(1);
		expect(f.db.select().from(releaseDownloads).all()).toHaveLength(0);
	});

	it('un repositorio que falla no impide consultar los demás', async () => {
		const other = addOtherApp();
		const result = await runDownloads(
			deps({
				releaseSources: [
					{ slug: 'secretario', repo: 'danimardo/secretario2' },
					{ slug: 'otra-app', repo: 'danimardo/otra' }
				],
				appIdOfSlug: (slug) =>
					slug === 'secretario' ? SEEDED_APP_ID : slug === 'otra-app' ? other : null,
				fetchReleases: (repo) =>
					repo === 'danimardo/secretario2'
						? Promise.reject(new Error('caído'))
						: Promise.resolve([{ assets: [{ download_count: 7 }] }])
			})
		);

		expect(result).toBe(1);
		expect(eventsNamed(f.logger, 'stats.downloads.fetch_failed')).toHaveLength(1);
		const rows = f.db.select().from(releaseDownloads).all();
		expect(rows.map((row) => [row.appId, row.cumulativeDownloads])).toEqual([[other, 7]]);
	});
});

function addOtherApp(): string {
	const ctx = appsTestContext(f.db, 93);
	return addSecondApp(ctx);
}

describe('precio de referencia (BE-FR-73)', () => {
	it('es la mediana de las muestras, y el valor manual manda', () => {
		const operationId = addOperation(
			appsTestContext(f.db, 91),
			SEEDED_APP_ID,
			chatOperation('op_precio_prueba')
		);
		const samples = [
			{ operationId, costMicroUsd: 100 },
			{ operationId, costMicroUsd: 300 },
			{ operationId, costMicroUsd: 200 }
		];

		expect(runPrices(deps({ priceSamples: () => samples }))).toBe(1);
		expect(
			f.db.select().from(priceReferences).where(eq(priceReferences.operationId, operationId)).get()
				?.typicalMicro
		).toBe(200);

		f.clock.advance(DAY);
		runPrices(deps({ priceSamples: () => samples, manualPriceOf: () => 999 }));
		const stored = f.db
			.select()
			.from(priceReferences)
			.where(eq(priceReferences.operationId, operationId))
			.get();
		expect(stored?.typicalMicro).toBe(999);
		expect(stored?.source).toBe('manual');
	});
});
