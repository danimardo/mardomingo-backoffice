// Apps con documento sincronizado de la cuenta (T260; BE-FR-85/CA1) contra SQLite real: una app aparece si la cuenta tiene un
// documento en ella, y nunca la de otra cuenta.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { syncedAppIds } from './synced-apps';
import { syncDocuments } from './schema';

let f: CreditsFixture;
let userId: string;

beforeEach(() => {
	f = creditsFixture(Date.UTC(2026, 9, 11, 8, 0, 0));
	userId = f.addUser('usr_sync_apps');
});

afterEach(() => {
	f.close();
});

describe('syncedAppIds (T260)', () => {
	it('devuelve las apps con documento de la cuenta y no las de otra', () => {
		expect([...syncedAppIds(f.db, userId)]).toEqual([]);

		f.db.insert(syncDocuments).values({ userId, appId: SEEDED_APP_ID, data: {} }).run();

		expect([...syncedAppIds(f.db, userId)]).toEqual([SEEDED_APP_ID]);
		expect(syncedAppIds(f.db, f.addUser('usr_sync_otro')).size).toBe(0);
	});
});
