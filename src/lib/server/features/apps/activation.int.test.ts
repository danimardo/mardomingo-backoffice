// Activación de operaciones contra SQLite real (W41; BE-FR-77 CA1–CA3, BE-FR-78; T311): un rechazo deja la operación inactiva y
// emite su evento; una aceptación la activa y queda auditada en la misma transacción.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { addOperation, appsTestContext, chatOperation } from '../../../../../tests/builders/apps';
import { adminAudit } from '../audit/schema';
import { appOperations } from './schema';
import { activateOperation } from './activation';

let f: CreditsFixture;
let adminId: string;
let operationId: string;

beforeEach(() => {
	f = creditsFixture(Date.UTC(2026, 9, 17, 9, 0, 0));
	adminId = f.addUser('usr_admin_activar');
	operationId = addOperation(
		appsTestContext(f.db, 93),
		SEEDED_APP_ID,
		chatOperation('op_activar_prueba')
	);
	f.db.update(appOperations).set({ active: false }).where(eq(appOperations.id, operationId)).run();
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

describe('activación de operaciones (T311)', () => {
	it('un rechazo deja la operación inactiva y emite el evento con su motivo', () => {
		expect(() => {
			activateOperation(deps(), {
				actorId: adminId,
				operationId,
				check: { ok: false, reason: 'model_incapable' },
				reason: 'prueba'
			});
		}).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));

		expect(isActive()).toBe(false);
		expect(eventsNamed(f.logger, 'apps.operation.activation_rejected')).toEqual([
			expect.objectContaining({ fields: { reason: 'model_incapable' } })
		]);
		expect(
			f.db.select().from(adminAudit).where(eq(adminAudit.action, 'apps.operation.activate')).all()
		).toEqual([]);
	});

	it('una aceptación activa la operación y queda auditada', () => {
		activateOperation(deps(), {
			actorId: adminId,
			operationId,
			check: { ok: true },
			reason: 'puesta en marcha'
		});

		expect(isActive()).toBe(true);
		expect(
			f.db.select().from(adminAudit).where(eq(adminAudit.action, 'apps.operation.activate')).all()
		).toEqual([
			expect.objectContaining({
				action: 'apps.operation.activate',
				entity: 'operation',
				entityId: operationId,
				adminId,
				reason: 'puesta en marcha'
			})
		]);
	});
});
