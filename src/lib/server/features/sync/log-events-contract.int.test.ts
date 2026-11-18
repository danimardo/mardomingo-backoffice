// S-05 · Los eventos de `sync` no siguen contracts/log-events.md 3.10 ni api-v1 E10–E11: faltan `sync.document.read` (debug,
// `durationMs`) y `sync.document.written` (info, `durationMs`); `sync.document.rejected` usa `reason: 'validation'` en lugar de
// `schema_invalid`, no lleva `errorCode` y no se emite con `if_match_invalid`; `sync.tombstones.purged` lleva `removed` (uno por
// documento) en lugar de `count`; `sync.defaults.updated` y `sync.defaults.copied` no llevan `count`. Ver sync/events.ts:5-12
// y sync/service.ts:76-206.
// Copiar a: src/lib/server/features/sync/log-events-contract.int.test.ts
// Ejecutar: pnpm exec vitest run --project integration src/lib/server/features/sync/log-events-contract.int.test.ts
// Supone que los emite el servicio; si se decide emitir `read`/`written` en la ruta (donde se mide `durationMs`), pasar el primer
// caso a un test HTTP de tests/http/api-sync.test.ts.
// Debe FALLAR hoy: no hay `sync.document.written` ni `sync.document.read`, y `rejected` lleva `validation` sin `errorCode`.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import {
	addSecondApp,
	appsTestContext,
	type AppsTestContext
} from '../../../../../tests/builders/apps';
import { getSyncDocument, putSyncDocument, type SyncDeps } from './index';

let fixture: CreditsFixture;
let ctx: AppsTestContext;
let deps: SyncDeps;
let userId: string;
let appId: string;

const named = (name: Parameters<typeof eventsNamed>[1]) => eventsNamed(fixture.logger, name);

beforeEach(() => {
	fixture = creditsFixture(Date.UTC(2026, 10, 18, 8, 0, 0));
	ctx = appsTestContext(fixture.db);
	userId = fixture.addUser('usr_sync_logs');
	deps = {
		db: fixture.db,
		clock: fixture.clock,
		logger: fixture.logger,
		apps: { db: fixture.db, logger: fixture.logger, clock: fixture.clock, ids: ctx.deps.ids },
		audit: { clock: fixture.clock, ids: ctx.deps.ids, logger: fixture.logger }
	};
	appId = addSecondApp(ctx);
});

afterEach(() => {
	fixture.close();
});

describe('eventos de sync según log-events 3.10 (S-05)', () => {
	it('GET emite sync.document.read y PUT correcto emite sync.document.written, con durationMs', () => {
		getSyncDocument(deps, { userId, appId });
		putSyncDocument(deps, {
			userId,
			appId,
			ifMatch: 1,
			data: { notas: { value: 'x', updatedAt: 1 } }
		});

		expect(named('sync.document.read')).toHaveLength(1);
		expect(named('sync.document.written')).toHaveLength(1);
		expect(named('sync.document.written')[0]?.fields).toHaveProperty('durationMs');
	});

	it('un documento con una categoría no declarada se registra como schema_invalid con su errorCode', () => {
		expect(() =>
			putSyncDocument(deps, {
				userId,
				appId,
				ifMatch: 1,
				data: { inventada: { value: 1, updatedAt: 1 } }
			})
		).toThrow();

		expect(named('sync.document.rejected').at(-1)?.fields).toEqual({
			reason: 'schema_invalid',
			errorCode: 'VALIDATION_ERROR'
		});
	});
});
