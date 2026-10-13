// Apps usadas por la cuenta (T260; BE-FR-49.11, D-13) contra SQLite real: solo lee `user_app_activity`, así que una app
// solo aparece si la cuenta la ha usado, y nunca la de otra cuenta.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { toEpochMs } from '$lib/shared/time';
import { userAppActivity } from './schema';
import { appsUsedBy } from './apps-used';

const NOW = Date.UTC(2026, 9, 11, 8, 0, 0);
let f: CreditsFixture;
let userId: string;

beforeEach(() => {
	f = creditsFixture(NOW);
	userId = f.addUser('usr_apps_usadas');
});

afterEach(() => {
	f.close();
});

describe('appsUsedBy (D-13)', () => {
	it('devuelve las apps que la cuenta ha usado y ninguna de otra', () => {
		expect(appsUsedBy(f.db, userId).has(SEEDED_APP_ID)).toBe(false);

		f.db
			.insert(userAppActivity)
			.values({
				userId,
				appId: SEEDED_APP_ID,
				firstLoginAt: toEpochMs(NOW),
				lastUsedAt: toEpochMs(NOW)
			})
			.run();

		expect([...appsUsedBy(f.db, userId)]).toEqual([SEEDED_APP_ID]);
		expect(appsUsedBy(f.db, f.addUser('usr_apps_otro')).size).toBe(0);
	});
});
