// Anuncios del panel contra SQLite real (T260; BE-FR-85/CA1): los globales y los de las apps de la cuenta, activos y vigentes, sin
// filtrar por versión, con el nombre de la app. Los inactivos, los caducados y los de apps ajenas no salen.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { toEpochMs } from '$lib/shared/time';
import { announcements } from './schema';
import { announcementsForPanel } from './panel-announcements';

const NOW = Date.UTC(2026, 9, 11, 8, 0, 0);
let f: CreditsFixture;

beforeEach(() => {
	f = creditsFixture(NOW);
});

afterEach(() => {
	f.close();
});

function add(
	id: string,
	row: { appId: string | null; active?: boolean; endsAt?: number | null }
): void {
	f.db
		.insert(announcements)
		.values({
			id,
			appId: row.appId,
			level: 'info',
			message: `Mensaje ${id}`,
			link: null,
			startsAt: toEpochMs(NOW - 1000),
			endsAt: row.endsAt === undefined || row.endsAt === null ? null : toEpochMs(row.endsAt),
			active: row.active ?? true,
			createdAt: toEpochMs(NOW),
			updatedAt: toEpochMs(NOW)
		})
		.run();
}

describe('announcementsForPanel (BE-FR-85/CA1)', () => {
	it('incluye los globales y los de las apps de la cuenta, con el nombre de la app', () => {
		add('ann_global', { appId: null });
		add('ann_secretario', { appId: SEEDED_APP_ID });

		const list = announcementsForPanel(f.deps.apps, [SEEDED_APP_ID], toEpochMs(NOW));

		expect(list.map((item) => item.id).sort()).toEqual(['ann_global', 'ann_secretario']);
		expect(list.find((item) => item.id === 'ann_secretario')).toMatchObject({
			appName: 'Secretario AI'
		});
		expect(list.find((item) => item.id === 'ann_global')).toMatchObject({ appName: null });
	});

	it('una app que no es de la cuenta no aporta sus anuncios', () => {
		add('ann_secretario', { appId: SEEDED_APP_ID });

		expect(announcementsForPanel(f.deps.apps, [], toEpochMs(NOW)).map((item) => item.id)).toEqual(
			[]
		);
	});

	it('no incluye los inactivos ni los caducados', () => {
		add('ann_inactivo', { appId: null, active: false });
		add('ann_caducado', { appId: null, endsAt: NOW - 1 });

		expect(announcementsForPanel(f.deps.apps, [], toEpochMs(NOW))).toEqual([]);
	});
});
