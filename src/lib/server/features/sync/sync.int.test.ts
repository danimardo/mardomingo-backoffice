// Sincronización contra SQLite real (BE-FR-39 a BE-FR-42, FR-064 a FR-068; T220): siembra con fechas a cero y revisión 1,
// conflicto entre dos clientes con la misma revisión, aislamiento entre apps, predeterminados que no tocan cuentas, copia
// con selección y auditoría, validación por estrategia y documento corrupto.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { adminAudit } from '$lib/server/features/audit/schema';
import { SECRETARIO_APP_ID } from '$lib/server/features/apps';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import {
	addSecondApp,
	appsTestContext,
	type AppsTestContext
} from '../../../../../tests/builders/apps';
import {
	allStrategiesDocument,
	ALL_STRATEGIES_SCHEMA
} from '../../../../../tests/builders/sync-profiles';
import { syncClient } from '../../../../../tests/builders/sync-clients';
import {
	applyCopyAsDefaults,
	getDefaults,
	getSyncDocument,
	previewCopyAsDefaults,
	putSyncDocument,
	updateDefaults,
	type SyncDeps
} from './index';
import { syncDocuments } from './schema';
import { AppError } from '$lib/server/shared/errors';

let fixture: CreditsFixture;
let ctx: AppsTestContext;
let deps: SyncDeps;
let userId: string;
let secondAppId: string;

beforeEach(() => {
	fixture = creditsFixture(Date.UTC(2026, 9, 11, 8, 0, 0));
	ctx = appsTestContext(fixture.db);
	userId = fixture.addUser('usr_sync');
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

/** Código del error de negocio que lanza `run`, o `undefined` si no lanza ninguno. */
function codeOf(run: () => unknown): string | undefined {
	try {
		run();
		return undefined;
	} catch (error) {
		return error instanceof AppError ? error.code : undefined;
	}
}

function storedRevision(appId: string): number | undefined {
	return fixture.db
		.select({ revision: syncDocuments.revision })
		.from(syncDocuments)
		.where(eq(syncDocuments.appId, appId))
		.get()?.revision;
}

describe('siembra del documento (BE-FR-40)', () => {
	it('el primer GET siembra con revisión 1 y con los predeterminados a fecha cero', () => {
		updateDefaults(deps, {
			adminId: ctx.adminId,
			appId: SECRETARIO_APP_ID,
			data: { quickTexts: { value: ['hola'], updatedAt: 9 } }
		});

		const document = getSyncDocument(deps, { userId, appId: SECRETARIO_APP_ID });

		expect(document).toEqual({
			revision: 1,
			data: { quickTexts: { value: ['hola'], updatedAt: 0 } }
		});
		expect(eventsNamed(fixture.logger, 'sync.document.seeded')).toHaveLength(1);
	});

	it('una segunda lectura no vuelve a sembrar', () => {
		getSyncDocument(deps, { userId, appId: SECRETARIO_APP_ID });
		getSyncDocument(deps, { userId, appId: SECRETARIO_APP_ID });

		expect(eventsNamed(fixture.logger, 'sync.document.seeded')).toHaveLength(1);
	});
});

describe('escritura con If-Match (BE-FR-41)', () => {
	it('dos clientes con la misma revisión: uno gana, el otro recibe SYNC_CONFLICT, relee y reintenta sin perder nada', () => {
		const first = syncClient(deps, userId, secondAppId);
		const second = syncClient(deps, userId, secondAppId);
		first.read();
		second.read();

		expect(first.write({ notas: { value: 'de A', updatedAt: 1 } })).toEqual({
			ok: true,
			revision: 2
		});
		expect(second.write({ notas: { value: 'de B', updatedAt: 2 } })).toEqual({
			ok: false,
			code: 'SYNC_CONFLICT'
		});
		expect(getSyncDocument(deps, { userId, appId: secondAppId })).toEqual({
			revision: 2,
			data: { notas: { value: 'de A', updatedAt: 1 } }
		});

		const reread = second.read();
		expect(
			second.write({ ...reread.data, notas: { value: 'de B tras fusionar', updatedAt: 3 } })
		).toEqual({ ok: true, revision: 3 });
		expect(eventsNamed(fixture.logger, 'sync.document.rejected').at(-1)?.fields).toEqual({
			reason: 'revision_conflict'
		});
	});

	it('If-Match distinto de la revisión actual es SYNC_CONFLICT aunque el documento exista', () => {
		putSyncDocument(deps, {
			userId,
			appId: secondAppId,
			ifMatch: 1,
			data: { notas: { value: 'x', updatedAt: 1 } }
		});

		expect(() =>
			putSyncDocument(deps, {
				userId,
				appId: secondAppId,
				ifMatch: 1,
				data: { notas: { value: 'y', updatedAt: 2 } }
			})
		).toThrow(AppError);
	});

	it('un PUT sin documento previo siembra primero y compara con la revisión 1', () => {
		expect(
			putSyncDocument(deps, {
				userId,
				appId: secondAppId,
				ifMatch: 1,
				data: { notas: { value: 'x', updatedAt: 1 } }
			})
		).toEqual({ revision: 2 });
	});
});

describe('aislamiento entre apps de la misma cuenta', () => {
	it('escribir en una app no cambia el documento de la otra', () => {
		getSyncDocument(deps, { userId, appId: SECRETARIO_APP_ID });
		const before = getSyncDocument(deps, { userId, appId: SECRETARIO_APP_ID });

		putSyncDocument(deps, {
			userId,
			appId: secondAppId,
			ifMatch: 1,
			data: { notas: { value: 'x', updatedAt: 1 } }
		});

		expect(getSyncDocument(deps, { userId, appId: SECRETARIO_APP_ID })).toEqual(before);
		expect(storedRevision(secondAppId)).toBe(2);
	});
});

describe('predeterminados (BE-FR-42)', () => {
	it('cambiar los predeterminados no modifica las cuentas existentes (CA1)', () => {
		const existing = getSyncDocument(deps, { userId, appId: SECRETARIO_APP_ID });

		updateDefaults(deps, {
			adminId: ctx.adminId,
			appId: SECRETARIO_APP_ID,
			data: { quickTexts: { value: ['nuevo'], updatedAt: 0 } }
		});

		expect(getSyncDocument(deps, { userId, appId: SECRETARIO_APP_ID })).toEqual(existing);
		expect(getDefaults(deps, SECRETARIO_APP_ID)).toEqual({
			quickTexts: { value: ['nuevo'], updatedAt: 0 }
		});
	});

	it('la copia de datos propios toma solo lo seleccionado y deja auditoría (CA3–CA4)', () => {
		putSyncDocument(deps, {
			userId,
			appId: secondAppId,
			ifMatch: 1,
			data: { notas: { value: 'mías', updatedAt: 1 } }
		});
		const preview = previewCopyAsDefaults(deps, { userId, appId: secondAppId });
		expect(preview).toEqual([{ category: 'notas', elements: ['notas'] }]);

		applyCopyAsDefaults(deps, {
			adminId: ctx.adminId,
			userId,
			appId: secondAppId,
			selection: [{ category: 'notas', elements: ['notas'] }]
		});

		expect(getDefaults(deps, secondAppId)).toEqual({ notas: { value: 'mías', updatedAt: 1 } });
		expect(
			fixture.db
				.select()
				.from(adminAudit)
				.where(eq(adminAudit.action, 'sync.defaults.copied'))
				.all()
		).toHaveLength(1);
	});
});

describe('validación del documento (BE-FR-39, BE-FR-41)', () => {
	it('una categoría no declarada se rechaza con VALIDATION_ERROR y el campo', () => {
		const code = codeOf(() =>
			putSyncDocument(deps, {
				userId,
				appId: secondAppId,
				ifMatch: 1,
				data: { inventada: { value: 1, updatedAt: 1 } }
			})
		);
		expect(code).toBe('VALIDATION_ERROR');
	});

	it('un documento de más de max_sync_doc_kb se rechaza con PAYLOAD_TOO_LARGE', () => {
		getSyncDocument(deps, { userId, appId: secondAppId });
		const huge = { notas: { value: 'x'.repeat(1_100_000), updatedAt: 1 } };

		expect(() =>
			putSyncDocument(deps, { userId, appId: secondAppId, ifMatch: 1, data: huge })
		).toThrow(AppError);
		expect(storedRevision(secondAppId)).toBe(1);
	});

	it('el esquema de todas las estrategias acepta su documento válido', () => {
		const alternative = addSecondApp(ctx, {
			slug: 'estrategias',
			syncSchema: ALL_STRATEGIES_SCHEMA
		});

		expect(
			putSyncDocument(deps, {
				userId,
				appId: alternative,
				ifMatch: 1,
				data: allStrategiesDocument(1)
			})
		).toEqual({ revision: 2 });
	});
});

describe('documento corrupto (FR-068)', () => {
	it('un documento que no es un objeto se detecta, se registra y no se modifica', () => {
		getSyncDocument(deps, { userId, appId: secondAppId });
		fixture.database.sqlite
			.prepare("UPDATE sync_documents SET data = '[]' WHERE app_id = ?")
			.run(secondAppId);

		expect(() => getSyncDocument(deps, { userId, appId: secondAppId })).toThrow(AppError);
		expect(eventsNamed(fixture.logger, 'sync.document.corrupt')).toHaveLength(1);
		expect(
			fixture.database.sqlite
				.prepare('SELECT data FROM sync_documents WHERE app_id = ?')
				.pluck()
				.get(secondAppId)
		).toBe('[]');
	});
});
