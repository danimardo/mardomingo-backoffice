// Desactivar una operación exige motivo contra SQLite real (BE-FR-55, FR-094; D09 = R08 de la propuesta de administración): sin motivo
// real (vacío o solo blancos) no cambia nada y no se audita; con motivo, se desactiva y queda auditado.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { addOperation, appsTestContext, chatOperation } from '../../../../../tests/builders/apps';
import { adminAudit } from '../audit/schema';
import { AppError } from '$lib/server/shared/errors';
import { appOperations } from './schema';
import { deactivateOperation } from './activation';

let f: CreditsFixture;
let adminId: string;
let operationId: string;

beforeEach(() => {
	f = creditsFixture(Date.UTC(2026, 9, 17, 9, 0, 0));
	adminId = f.addUser('usr_admin_desactivar');
	operationId = addOperation(
		appsTestContext(f.db, 94),
		SEEDED_APP_ID,
		chatOperation('op_desactivar_motivo')
	);
	f.db.update(appOperations).set({ active: true }).where(eq(appOperations.id, operationId)).run();
});

afterEach(() => {
	f.close();
});

function deps() {
	return { db: f.db, logger: f.logger, clock: f.clock, ids: f.deps.ids };
}

function isActive(): boolean | undefined {
	return f.db.select().from(appOperations).where(eq(appOperations.id, operationId)).get()?.active;
}

function deactivationAudits(): number {
	return f.db
		.select()
		.from(adminAudit)
		.where(eq(adminAudit.action, 'apps.operation.deactivate'))
		.all().length;
}

describe('desactivar una operación exige motivo (D09 = R08)', () => {
	it.each(['', '   ', '\t\n'])(
		'el motivo %j no vale: rechaza con error de campo reason y no cambia nada',
		(reason) => {
			let error: unknown;
			try {
				deactivateOperation(deps(), { actorId: adminId, operationId, reason });
			} catch (caught) {
				error = caught;
			}

			expect(error).toBeInstanceOf(AppError);
			expect(error instanceof AppError ? error.details : undefined).toEqual({ field: 'reason' });
			expect(isActive()).toBe(true);
			expect(deactivationAudits()).toBe(0);
		}
	);

	it('un motivo de un solo carácter visible sí vale y desactiva la operación con auditoría', () => {
		deactivateOperation(deps(), { actorId: adminId, operationId, reason: 'x' });

		expect(isActive()).toBe(false);
		expect(deactivationAudits()).toBe(1);
	});
});
