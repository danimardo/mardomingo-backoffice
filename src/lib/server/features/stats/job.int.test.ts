// Tarea diaria contra SQLite real (L14; BE-FR-54, BE-FR-73, BE-FR-16): un día corre una sola vez, las descargas se guardan con su
// diferencia respecto al día anterior, un paso que falla no para a los demás, y el precio de referencia respeta el valor manual.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { addOperation, appsTestContext, chatOperation } from '../../../../../tests/builders/apps';
import { savePriceReference } from '../pricing';
import { priceReferences } from '../pricing/schema';
import { dailyJobRuns, releaseDownloads } from './schema';
import { runDailyJob, type DailyJobDeps } from './job';

const DAY = 24 * 60 * 60 * 1000;
let f: CreditsFixture;
let releases: number[];
let failFetch: boolean;
let expired: { buckets: number; holds: number };

function deps(overrides: Partial<DailyJobDeps> = {}): DailyJobDeps {
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
		expireBuckets: () => {
			expired.buckets += 1;
			return 0;
		},
		expireHolds: () => {
			expired.holds += 1;
			return 0;
		},
		...overrides
	};
}

beforeEach(() => {
	f = creditsFixture(Date.UTC(2026, 9, 17, 9, 0, 0));
	releases = [100];
	failFetch = false;
	expired = { buckets: 0, holds: 0 };
});

afterEach(() => {
	f.close();
});

describe('tarea diaria (L14)', () => {
	it('un día corre una sola vez: la segunda ejecución del mismo día no hace nada', async () => {
		expect(await runDailyJob(deps())).toBe('ran');
		expect(await runDailyJob(deps())).toBe('already_ran');
		expect(f.db.select().from(dailyJobRuns).all()).toHaveLength(1);
		expect(expired.buckets).toBe(1);
	});

	it('las descargas guardan el acumulado y la diferencia con el día anterior; el primer día no tiene diferencia', async () => {
		await runDailyJob(deps());
		f.clock.advance(DAY);
		releases = [130];
		await runDailyJob(deps());

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

	it('si GitHub falla, el paso se registra, los demás siguen y el día queda como parcial', async () => {
		failFetch = true;

		await runDailyJob(deps());

		expect(eventsNamed(f.logger, 'stats.daily_job.step_failed')).toHaveLength(1);
		expect(expired.buckets).toBe(1);
		expect(f.db.select().from(dailyJobRuns).get()?.outcome).toBe('partial');
	});

	it('el precio de referencia es la mediana de las muestras, y el valor manual manda', async () => {
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

		await runDailyJob(deps({ priceSamples: () => samples }));
		expect(
			f.db.select().from(priceReferences).where(eq(priceReferences.operationId, operationId)).get()
				?.typicalMicro
		).toBe(200);

		f.clock.advance(DAY);
		await runDailyJob(deps({ priceSamples: () => samples, manualPriceOf: () => 999 }));
		const stored = f.db
			.select()
			.from(priceReferences)
			.where(eq(priceReferences.operationId, operationId))
			.get();
		expect(stored?.typicalMicro).toBe(999);
		expect(stored?.source).toBe('manual');
	});
});
