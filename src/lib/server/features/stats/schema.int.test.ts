// Restricciones de `release_downloads` contra SQLite real (BE-FR-54; data-model 2.14; T299): una fila por app y día, fechas con
// formato y contadores no negativos.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { toCivilDate } from '$lib/shared/time';
import { toEpochMs } from '$lib/shared/time';
import { releaseDownloads } from './schema';

let fixture: CreditsFixture;

beforeEach(() => {
	fixture = creditsFixture(Date.UTC(2026, 9, 11, 8, 0, 0));
});

afterEach(() => {
	fixture.close();
});

function row(overrides: Partial<typeof releaseDownloads.$inferInsert> = {}) {
	return {
		appId: SEEDED_APP_ID,
		day: toCivilDate('2026-10-11'),
		cumulativeDownloads: 10,
		downloads: null,
		fetchedAt: toEpochMs(Date.UTC(2026, 9, 11, 3, 0, 0)),
		...overrides
	};
}

describe('restricciones de release_downloads (data-model 2.14)', () => {
	it('la primera lectura no tiene diferencia y entra sin ella', () => {
		expect(() => fixture.db.insert(releaseDownloads).values(row()).run()).not.toThrow();
	});

	it('una app y un día forman una sola fila', () => {
		fixture.db.insert(releaseDownloads).values(row()).run();

		expect(() =>
			fixture.db
				.insert(releaseDownloads)
				.values(row({ cumulativeDownloads: 12 }))
				.run()
		).toThrow();
	});

	it('el contador acumulado y la diferencia no son negativos', () => {
		expect(() =>
			fixture.db
				.insert(releaseDownloads)
				.values(row({ cumulativeDownloads: -1 }))
				.run()
		).toThrow();
		expect(() =>
			fixture.db
				.insert(releaseDownloads)
				.values(row({ day: toCivilDate('2026-10-12'), downloads: -3 }))
				.run()
		).toThrow();
	});

	it('el día tiene formato AAAA-MM-DD', () => {
		expect(() =>
			fixture.database.sqlite
				.prepare(
					'INSERT INTO release_downloads (app_id, day, cumulative_downloads, fetched_at) VALUES (?, ?, ?, ?)'
				)
				.run(SEEDED_APP_ID, '11/10/2026', 1, 0)
		).toThrow();
	});

	it('la app debe existir', () => {
		expect(() =>
			fixture.db
				.insert(releaseDownloads)
				.values(row({ appId: 'app_inexistente' }))
				.run()
		).toThrow();
	});
});
