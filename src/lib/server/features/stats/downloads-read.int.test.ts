// Descargas de releases para el embudo de W45 contra SQLite real (BE-FR-54; T318): cuenta solo los días del periodo con dato; un día
// sin descargas registradas no suma y no es cero.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { toCivilDate, toEpochMs } from '$lib/shared/time';
import { releaseDownloads } from './schema';
import { releaseDownloadsBetween } from './downloads-read';

let f: CreditsFixture;

beforeEach(() => {
	f = creditsFixture(Date.UTC(2026, 9, 17, 9, 0, 0));
});

afterEach(() => {
	f.close();
});

function row(day: string, downloads: number | null) {
	return {
		appId: SEEDED_APP_ID,
		day: toCivilDate(day),
		cumulativeDownloads: 100,
		downloads,
		fetchedAt: toEpochMs(Date.UTC(2026, 9, 17, 9, 0, 0))
	};
}

describe('descargas de releases del periodo (W45, T318)', () => {
	it('suma solo los días del periodo con dato y omite los días sin descargas registradas', () => {
		f.db
			.insert(releaseDownloads)
			.values([
				row('2026-10-01', 5),
				row('2026-10-02', null),
				row('2026-10-05', 7),
				row('2026-11-01', 9)
			])
			.run();

		const period = { fromDay: toCivilDate('2026-10-01'), toDay: toCivilDate('2026-10-31') };
		const facts = releaseDownloadsBetween(f.db, period);

		expect(facts).toEqual([
			{ appId: SEEDED_APP_ID, downloads: 5 },
			{ appId: SEEDED_APP_ID, downloads: 7 }
		]);
	});

	it('sin filas en el periodo no hay descargas, no cero', () => {
		const period = { fromDay: toCivilDate('2026-01-01'), toDay: toCivilDate('2026-01-31') };
		expect(releaseDownloadsBetween(f.db, period)).toEqual([]);
	});
});
