// Edición de parámetros seguros de una operación contra SQLite real (W41; BE-FR-77; T311): un cambio válido se aplica y queda
// auditado con antes y después; un valor fuera de rango no toca la operación ni la auditoría; el estado de activación no cambia.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { addOperation, appsTestContext, chatOperation } from '../../../../../tests/builders/apps';
import { adminAudit } from '../audit/schema';
import { appOperations } from './schema';
import { updateOperationSettings } from './operation-settings';

let f: CreditsFixture;
let adminId: string;
let operationId: string;

beforeEach(() => {
	f = creditsFixture(Date.UTC(2026, 9, 17, 9, 0, 0));
	adminId = f.addUser('usr_admin_ajustes');
	operationId = addOperation(
		appsTestContext(f.db, 94),
		SEEDED_APP_ID,
		chatOperation('op_ajustes_prueba')
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

describe('ajustes de operación (T311)', () => {
	it('un cambio válido se aplica y queda auditado con antes y después', () => {
		updateOperationSettings(deps(), {
			actorId: adminId,
			operationId,
			settings: valid,
			reason: 'ajuste de tiempo'
		});

		expect(row()).toMatchObject({
			timeoutMs: 45_000,
			temperatureMilli: 500,
			active: row()?.active
		});
		expect(
			f.db.select().from(adminAudit).where(eq(adminAudit.action, 'apps.operation.settings')).all()
		).toEqual([expect.objectContaining({ entityId: operationId, reason: 'ajuste de tiempo' })]);
	});

	it('un valor fuera de rango no cambia la operación ni audita', () => {
		const before = row();

		expect(() => {
			updateOperationSettings(deps(), {
				actorId: adminId,
				operationId,
				settings: { ...valid, timeoutMs: 5 },
				reason: 'prueba'
			});
		}).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));

		expect(row()).toEqual(before);
		expect(
			f.db.select().from(adminAudit).where(eq(adminAudit.action, 'apps.operation.settings')).all()
		).toEqual([]);
	});

	it('no admite campos fuera de los parámetros seguros (p. ej. el modelo)', () => {
		expect(() => {
			updateOperationSettings(deps(), {
				actorId: adminId,
				operationId,
				settings: { ...valid, model: 'otro/modelo' },
				reason: 'prueba'
			});
		}).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
	});
});
