// Limpieza diaria de marcas de borrado contra SQLite real (FR-064, H-27; T338): un documento con marcas caducadas sube su
// revisión y pierde solo esas marcas; uno sin marcas caducadas no cambia; el evento lleva solo el recuento.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SECRETARIO_APP_ID } from '$lib/server/features/apps';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import {
	addSecondApp,
	appsTestContext,
	type AppsTestContext
} from '../../../../../tests/builders/apps';
import { toEpochMs } from '$lib/shared/time';
import { purgeTombstones, type SyncDeps } from './index';
import { syncDocuments } from './schema';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 24, 4, 25);

let fixture: CreditsFixture;
let ctx: AppsTestContext;
let deps: SyncDeps;
let secondAppId: string;

beforeEach(() => {
	fixture = creditsFixture(NOW);
	ctx = appsTestContext(fixture.db);
	deps = {
		db: fixture.db,
		clock: fixture.clock,
		logger: fixture.logger,
		apps: { db: fixture.db, logger: fixture.logger, clock: fixture.clock, ids: ctx.deps.ids },
		audit: { clock: fixture.clock, ids: ctx.deps.ids, logger: fixture.logger }
	};
	secondAppId = addSecondApp(ctx);
});

afterEach(() => {
	fixture.close();
});

function insertRow(userId: string, appId: string, revision: number, data: Record<string, unknown>) {
	fixture.db
		.insert(syncDocuments)
		.values({ userId, appId, revision, data, createdAt: toEpochMs(NOW), updatedAt: toEpochMs(NOW) })
		.run();
}

function storedOf(userId: string) {
	return fixture.db
		.select({ revision: syncDocuments.revision, data: syncDocuments.data })
		.from(syncDocuments)
		.where(eq(syncDocuments.userId, userId))
		.get();
}

describe('limpieza de marcas de borrado (T338)', () => {
	it('quita las marcas caducadas, sube la revisión y deja solo el recuento en el log', () => {
		const userA = fixture.addUser('usr_tomb_a');
		insertRow(userA, SECRETARIO_APP_ID, 3, {
			customReplacements: {
				items: [{ from: 'hola', updatedAt: 1 }],
				tombstones: [
					{ from: 'viejo', deletedAt: NOW - 40 * DAY_MS },
					{ from: 'reciente', deletedAt: NOW - DAY_MS }
				]
			}
		});

		const changed = purgeTombstones(deps);

		expect(changed).toBe(1);
		const stored = storedOf(userA);
		expect(stored?.revision).toBe(4);
		expect(stored?.data).toStrictEqual({
			customReplacements: {
				items: [{ from: 'hola', updatedAt: 1 }],
				tombstones: [{ from: 'reciente', deletedAt: NOW - DAY_MS }]
			}
		});
		const events = eventsNamed(fixture.logger, 'sync.tombstones.purged');
		expect(events).toHaveLength(1);
		expect(events[0]?.fields).toStrictEqual({ removed: 1 });
	});

	it('un documento sin marcas caducadas no cambia ni sube la revisión', () => {
		const userB = fixture.addUser('usr_tomb_b');
		insertRow(userB, secondAppId, 2, {});

		expect(purgeTombstones(deps)).toBe(0);
		expect(storedOf(userB)?.revision).toBe(2);
		expect(eventsNamed(fixture.logger, 'sync.tombstones.purged')).toHaveLength(0);
	});
});
