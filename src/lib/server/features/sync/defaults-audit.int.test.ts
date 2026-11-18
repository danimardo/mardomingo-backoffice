// Motivo y auditoría sin contenido de W42 y W43 (BE-FR-55; C-41, T433) y predeterminados que un cambio del esquema deja
// fuera (BE-FR-39, BE-FR-40; C-45, T437). La auditoría guarda categorías, número de elementos, SHA-256 y categorías
// cambiadas, nunca el JSON; la siembra omite lo que el esquema vigente no admite, y `staleDefaultCategories` lo nombra.
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { adminAudit } from '$lib/server/features/audit/schema';
import { AppError } from '$lib/server/shared/errors';
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
import { canonicalJson } from './domain/defaults-summary';
import {
	applyCopyAsDefaults,
	getDefaults,
	getSyncDocument,
	putSyncDocument,
	staleDefaultCategories,
	updateDefaults,
	type SyncDeps
} from './index';

let fixture: CreditsFixture;
let ctx: AppsTestContext;
let deps: SyncDeps;
let userId: string;
let appId: string;

beforeEach(() => {
	fixture = creditsFixture(Date.UTC(2026, 10, 18, 8, 0, 0));
	ctx = appsTestContext(fixture.db);
	userId = fixture.addUser('usr_defaults_audit');
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

function auditsOf(action: string) {
	return fixture.db.select().from(adminAudit).where(eq(adminAudit.action, action)).all();
}

function codeOf(run: () => void): string | undefined {
	try {
		run();
		return undefined;
	} catch (error) {
		return error instanceof AppError ? `${error.code}:${String(error.details.field)}` : 'other';
	}
}

const sha256 = (data: unknown) =>
	createHash('sha256').update(canonicalJson(data), 'utf8').digest('hex');

/** Cambia el esquema de la app como lo haría W40, con su fecha nueva (invalida la caché del esquema de `sync`). */
function changeSchema(schema: unknown): void {
	fixture.database.sqlite
		.prepare('UPDATE apps SET sync_schema = ?, updated_at = updated_at + 1000 WHERE id = ?')
		.run(JSON.stringify(schema), appId);
}

describe('motivo obligatorio (C-41, BE-FR-55)', () => {
	it.each(['', '   '])(
		'guardar predeterminados con el motivo «%s» no escribe ni audita',
		(reason) => {
			expect(
				codeOf(() => {
					updateDefaults(deps, {
						adminId: ctx.adminId,
						appId,
						data: allStrategiesDocument(1),
						reason
					});
				})
			).toBe('VALIDATION_ERROR:reason');
			expect(getDefaults(deps, appId)).toEqual({});
			expect(auditsOf('sync.defaults.updated')).toHaveLength(0);
		}
	);

	it('copiar con el motivo vacío no escribe ni audita', () => {
		putSyncDocument(deps, { userId, appId, ifMatch: 1, data: allStrategiesDocument(3) });

		expect(
			codeOf(() => {
				applyCopyAsDefaults(deps, {
					adminId: ctx.adminId,
					userId,
					appId,
					selection: [{ category: 'prompts', elements: ['prompts'] }],
					reason: ''
				});
			})
		).toBe('VALIDATION_ERROR:reason');
		expect(getDefaults(deps, appId)).toEqual({});
		expect(auditsOf('sync.defaults.copied')).toHaveLength(0);
	});

	it('una selección que no casa con nada lanza NOTHING_SELECTED (C-40)', () => {
		putSyncDocument(deps, { userId, appId, ifMatch: 1, data: allStrategiesDocument(3) });

		expect(
			codeOf(() => {
				applyCopyAsDefaults(deps, {
					adminId: ctx.adminId,
					userId,
					appId,
					selection: [{ category: 'replacements', elements: ['no-existe'] }],
					reason: 'Copia caducada'
				});
			})
		).toBe('NOTHING_SELECTED:undefined');
	});
});

describe('auditoría sin contenido (C-41, BE-FR-55)', () => {
	it('guardar deja el motivo recortado, el resumen anterior y el nuevo con las categorías cambiadas, sin el JSON', () => {
		const first = allStrategiesDocument(1, 'secreto-antes');
		updateDefaults(deps, { adminId: ctx.adminId, appId, data: first, reason: 'Primera versión' });
		const second = { ...first, prompts: { value: ['dato personal'], updatedAt: 2 } };

		updateDefaults(deps, {
			adminId: ctx.adminId,
			appId,
			data: second,
			reason: '  Cambio de prompts  '
		});

		const [created, changed] = auditsOf('sync.defaults.updated');
		// Sin fila previa no hay estado anterior que resumir.
		expect(created?.before).toBeNull();
		expect(changed?.reason).toBe('Cambio de prompts');
		expect(changed?.before).toEqual({
			categories: ['preferences', 'prompts', 'replacements'],
			elements: 3,
			sha256: sha256(first)
		});
		expect(changed?.after).toEqual({
			categories: ['preferences', 'prompts', 'replacements'],
			elements: 3,
			sha256: sha256(second),
			changed: ['prompts']
		});
		const stored = JSON.stringify([changed?.before, changed?.after]);
		expect(stored).not.toContain('dato personal');
		expect(stored).not.toContain('secreto-antes');
	});

	it('copiar deja el motivo y en `changed` solo las categorías sustituidas', () => {
		const base = allStrategiesDocument(1);
		updateDefaults(deps, { adminId: ctx.adminId, appId, data: base, reason: 'Base' });
		putSyncDocument(deps, {
			userId,
			appId,
			ifMatch: 1,
			data: { prompts: { value: ['mi prompt'], updatedAt: 9 } }
		});

		applyCopyAsDefaults(deps, {
			adminId: ctx.adminId,
			userId,
			appId,
			selection: [{ category: 'prompts', elements: ['prompts'] }],
			reason: 'Prompt del equipo'
		});

		const [entry] = auditsOf('sync.defaults.copied');
		expect(entry?.reason).toBe('Prompt del equipo');
		expect(entry?.after).toMatchObject({ changed: ['prompts'], elements: 3 });
		expect(JSON.stringify(entry?.after)).not.toContain('mi prompt');
	});
});

describe('predeterminados fuera del esquema vigente (C-45, BE-FR-39/40)', () => {
	it('tras quitar una categoría y cambiar otra de estrategia, la siembra las omite y el documento se reenvía tal cual', () => {
		updateDefaults(deps, {
			adminId: ctx.adminId,
			appId,
			data: allStrategiesDocument(5),
			reason: 'Antes del cambio de esquema'
		});
		changeSchema({
			categories: {
				// `replacements` desaparece y `preferences` pasa de keyed a block.
				prompts: { strategy: 'block' },
				preferences: { strategy: 'block' }
			}
		});

		expect(staleDefaultCategories(deps, appId)).toEqual(['replacements', 'preferences']);
		const seeded = getSyncDocument(deps, { userId, appId });
		expect(seeded.data).toEqual({ prompts: { value: ['resumen'], updatedAt: 0 } });
		expect(putSyncDocument(deps, { userId, appId, ifMatch: 1, data: seeded.data })).toEqual({
			revision: 2
		});
		// Los predeterminados guardados no se tocan: solo los corrige el administrador en W42.
		expect(getDefaults(deps, appId)).toEqual(allStrategiesDocument(5));
	});

	it('con predeterminados que encajan en el esquema no hay nada que avisar', () => {
		updateDefaults(deps, {
			adminId: ctx.adminId,
			appId,
			data: allStrategiesDocument(5),
			reason: 'Predeterminados válidos'
		});

		expect(staleDefaultCategories(deps, appId)).toEqual([]);
	});
});
