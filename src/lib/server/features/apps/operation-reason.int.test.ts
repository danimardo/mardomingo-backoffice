// A-06 · Editar los parámetros de una operación, aplicarlos al grupo y activarla aceptan un motivo vacío (FR-094 y BE-FR-55:
// motivo en toda acción que modifica datos; W41 exige motivo y confirmación). `updateOperationSettings`
// (apps/operation-settings.ts:38) y `activateOperation` (apps/activation.ts:25) no comprueban el motivo y escriben la auditoría
// con `reason: ''`; las acciones `?/guardarOperacion`, `?/aplicarAlGrupo` y `?/activar` (operaciones/[key]/+page.server.ts:104-109,
// 178-183, 221-226) tampoco. `deactivateOperation` sí lo exige (activation.ts:67). La propuesta R08 da por hecho que
// «apps, operaciones y freno» ya exigen motivo (solo les falta el máximo): estas dos funciones no.
//
// Destino en el repo: src/lib/server/features/apps/operation-reason.int.test.ts
// Ejecutar: pnpm exec vitest run --project integration src/lib/server/features/apps/operation-reason.int.test.ts
// Debe FALLAR hoy: las dos llamadas con motivo vacío terminan sin error y dejan auditoría con motivo ''.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { addOperation, appsTestContext, chatOperation } from '../../../../../tests/builders/apps';
import { adminAudit } from '../audit/schema';
import { activateOperation } from './activation';
import { updateOperationSettings } from './operation-settings';
import { appOperations } from './schema';

let f: CreditsFixture;
let adminId: string;
let operationId: string;

beforeEach(() => {
	f = creditsFixture(Date.UTC(2026, 9, 17, 9, 0, 0));
	adminId = f.addUser('usr_admin_a06');
	operationId = addOperation(
		appsTestContext(f.db, 96),
		SEEDED_APP_ID,
		chatOperation('op_a06_motivo')
	);
});

afterEach(() => {
	f.close();
});

function deps() {
	return { db: f.db, logger: f.logger, clock: f.clock, ids: f.deps.ids };
}

function row() {
	return f.db.select().from(appOperations).where(eq(appOperations.id, operationId)).get();
}

const valid = {
	timeoutMs: 45_000,
	maxOutputTokens: 2000,
	temperatureMilli: 500,
	maxCostMicro: 900_000
};

describe('A-06 · motivo obligatorio en W41 (FR-094, BE-FR-55)', () => {
	it.each(['', '   '])(
		'guardar los parámetros con motivo «%s» no cambia nada ni audita',
		(reason) => {
			const before = row();

			expect(() => {
				updateOperationSettings(deps(), { actorId: adminId, operationId, settings: valid, reason });
			}).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));

			expect(row()).toEqual(before);
			expect(
				f.db.select().from(adminAudit).where(eq(adminAudit.action, 'apps.operation.settings')).all()
			).toEqual([]);
		}
	);

	it('activar con motivo vacío no activa ni audita', () => {
		f.db
			.update(appOperations)
			.set({ active: false })
			.where(eq(appOperations.id, operationId))
			.run();

		expect(() => {
			activateOperation(deps(), { actorId: adminId, operationId, check: { ok: true }, reason: '' });
		}).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));

		expect(row()?.active).toBe(false);
		expect(
			f.db.select().from(adminAudit).where(eq(adminAudit.action, 'apps.operation.activate')).all()
		).toEqual([]);
	});
});
