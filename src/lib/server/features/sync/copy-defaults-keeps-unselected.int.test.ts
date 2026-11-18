// S-01 · La copia de W43 borra de los predeterminados las categorías no seleccionadas (BE-FR-42 CA3, FR-067, W43: «solo
// sustituye las categorías con algún elemento seleccionado»). `applyCopyAsDefaults` (sync/service.ts:235-240) escribe con
// `writeDefaults` el resultado de `applyCopy`, que solo contiene lo seleccionado: el upsert sustituye el documento entero.
// Además, una selección que no casa con nada (categoría o elementos que ya no existen) produce `{}` y vacía los predeterminados.
// Copiar a: src/lib/server/features/sync/copy-defaults-keeps-unselected.int.test.ts
// Ejecutar: pnpm exec vitest run --project integration src/lib/server/features/sync/copy-defaults-keeps-unselected.int.test.ts
// Debe FALLAR hoy: el primer caso deja solo `prompts`; el segundo deja `{}` y audita una copia.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { adminAudit } from '$lib/server/features/audit/schema';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import {
	addSecondApp,
	appsTestContext,
	type AppsTestContext
} from '../../../../../tests/builders/apps';
import {
	allStrategiesDocument,
	ALL_STRATEGIES_SCHEMA
} from '../../../../../tests/builders/sync-profiles';
import {
	applyCopyAsDefaults,
	getDefaults,
	putSyncDocument,
	updateDefaults,
	type SyncDeps
} from './index';

let fixture: CreditsFixture;
let ctx: AppsTestContext;
let deps: SyncDeps;
let adminUserId: string;
let appId: string;

beforeEach(() => {
	fixture = creditsFixture(Date.UTC(2026, 10, 18, 8, 0, 0));
	ctx = appsTestContext(fixture.db);
	// La cuenta origen de la copia es la del propio administrador (D03); aquí basta con una cuenta con documento.
	adminUserId = fixture.addUser('usr_copia_origen');
	deps = {
		db: fixture.db,
		clock: fixture.clock,
		logger: fixture.logger,
		apps: { db: fixture.db, logger: fixture.logger, clock: fixture.clock, ids: ctx.deps.ids },
		audit: { clock: fixture.clock, ids: ctx.deps.ids, logger: fixture.logger }
	};
	appId = addSecondApp(ctx, { slug: 'estrategias', syncSchema: ALL_STRATEGIES_SCHEMA });
});

afterEach(() => {
	fixture.close();
});

function copiedAuditCount(): number {
	return fixture.db
		.select()
		.from(adminAudit)
		.where(eq(adminAudit.action, 'sync.defaults.copied'))
		.all().length;
}

describe('copia de datos propios como predeterminados (S-01, BE-FR-42 CA3)', () => {
	it('copiar solo `prompts` conserva `replacements` y `preferences` de los predeterminados', () => {
		const previous = allStrategiesDocument(5, 'predeterminado');
		updateDefaults(deps, {
			adminId: ctx.adminId,
			appId,
			data: previous,
			reason: 'Base de la prueba'
		});
		putSyncDocument(deps, {
			userId: adminUserId,
			appId,
			ifMatch: 1,
			data: { prompts: { value: ['mi prompt'], updatedAt: 9 } }
		});

		applyCopyAsDefaults(deps, {
			adminId: ctx.adminId,
			userId: adminUserId,
			appId,
			selection: [{ category: 'prompts', elements: ['prompts'] }],
			reason: 'Copia de prueba'
		});

		expect(getDefaults(deps, appId)).toEqual({
			...previous,
			prompts: { value: ['mi prompt'], updatedAt: 9 }
		});
	});

	it('una selección que no casa con nada no toca los predeterminados ni deja auditoría', () => {
		const previous = allStrategiesDocument(5, 'predeterminado');
		updateDefaults(deps, {
			adminId: ctx.adminId,
			appId,
			data: previous,
			reason: 'Base de la prueba'
		});
		putSyncDocument(deps, {
			userId: adminUserId,
			appId,
			ifMatch: 1,
			data: { prompts: { value: ['mi prompt'], updatedAt: 9 } }
		});
		const auditBefore = copiedAuditCount();

		// Formulario con una categoría inexistente o un elemento que ya no está en el documento (vista previa caducada).
		try {
			applyCopyAsDefaults(deps, {
				adminId: ctx.adminId,
				userId: adminUserId,
				appId,
				selection: [
					{ category: 'inventada', elements: ['x'] },
					{ category: 'replacements', elements: ['no-existe'] }
				],
				reason: 'Copia de prueba'
			});
		} catch {
			// Se acepta que rechace (NOTHING_SELECTED o VALIDATION_ERROR); lo que no puede es escribir.
		}

		expect(getDefaults(deps, appId)).toEqual(previous);
		expect(copiedAuditCount()).toBe(auditBefore);
	});
});
