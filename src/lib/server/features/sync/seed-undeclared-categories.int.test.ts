// S-06 · La siembra copia los predeterminados sin filtrarlos por el esquema vigente (data-model 3.3: «objeto con solo las
// categorías declaradas»; BE-FR-39). Si el administrador quita o cambia de estrategia una categoría en W40 después de guardar los
// predeterminados (apps no puede revalidar `app_defaults`, que es de `sync`), `documentOrSeed` (sync/service.ts:81-84) siembra un
// documento que el propio servidor rechaza: el cliente que lo devuelve tal cual recibe VALIDATION_ERROR en cada PUT.
// Aquí se simula el cambio de esquema dejando en `app_defaults` una categoría que el esquema ya no declara.
// Copiar a: src/lib/server/features/sync/seed-undeclared-categories.int.test.ts
// Ejecutar: pnpm exec vitest run --project integration src/lib/server/features/sync/seed-undeclared-categories.int.test.ts
// Debe FALLAR hoy: el documento sembrado contiene `retirada` y su reenvío responde VALIDATION_ERROR.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
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

beforeEach(() => {
	fixture = creditsFixture(Date.UTC(2026, 10, 18, 8, 0, 0));
	ctx = appsTestContext(fixture.db);
	userId = fixture.addUser('usr_sync_seed_schema');
	deps = {
		db: fixture.db,
		clock: fixture.clock,
		logger: fixture.logger,
		apps: { db: fixture.db, logger: fixture.logger, clock: fixture.clock, ids: ctx.deps.ids },
		audit: { clock: fixture.clock, ids: ctx.deps.ids, logger: fixture.logger }
	};
	appId = addSecondApp(ctx); // esquema { notas: block }
	// Predeterminados guardados con un esquema anterior que tenía `retirada`.
	fixture.database.sqlite
		.prepare('INSERT INTO app_defaults (app_id, data, updated_at) VALUES (?, ?, ?)')
		.run(
			appId,
			JSON.stringify({
				notas: { value: 'nota base', updatedAt: 5 },
				retirada: { value: 'categoría ya no declarada', updatedAt: 5 }
			}),
			Date.UTC(2026, 10, 18, 8, 0, 0)
		);
});

afterEach(() => {
	fixture.close();
});

describe('siembra con el esquema vigente (S-06, BE-FR-39/40)', () => {
	it('el documento sembrado solo contiene categorías declaradas y se puede reenviar tal cual', () => {
		const seeded = getSyncDocument(deps, { userId, appId });

		expect(Object.keys(seeded.data)).toEqual(['notas']);
		expect(
			putSyncDocument(deps, { userId, appId, ifMatch: seeded.revision, data: seeded.data })
		).toEqual({ revision: 2 });
	});
});
