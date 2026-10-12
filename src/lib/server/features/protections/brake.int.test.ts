// Freno global de gasto contra SQLite real (BE-FR-46 CA1–CA2, FR-072; T199, T202, T203, T207): el coste de las cuentas sin
// compra real se suma por día de Madrid, se guarda al activarse, avisa una sola vez al administrador, rechaza mientras
// está activo, se rearma al cambiar de día y se libera a mano con auditoría.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { adminAudit } from '$lib/server/features/audit/schema';
import { createIdGenerator } from '$lib/server/shared/ids';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { markRealPurchase } from '../../../../../tests/builders/purchases';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import {
	OVER_BRAKE_COST_MICRO_USD,
	guard,
	protectionsHarness,
	requestFor,
	type ProtectionsHarness
} from '../../../../../tests/builders/protections';
import { releaseBrake } from './index';
import { protectionState } from './schema';

const DAY_START = Date.UTC(2026, 9, 11, 8, 0, 0);

let fixture: CreditsFixture;
let harness: ProtectionsHarness;

beforeEach(() => {
	fixture = creditsFixture(DAY_START);
	harness = protectionsHarness(fixture);
});

afterEach(() => {
	fixture.close();
});

function brakeRow() {
	return fixture.db
		.select()
		.from(protectionState)
		.where(eq(protectionState.key, 'global_brake'))
		.get();
}

describe('freno global de gasto (BE-FR-46 CA1)', () => {
	it('al superar el límite del día se activa, se guarda, avisa una vez al administrador y rechaza', async () => {
		const deps = harness.deps;
		fixture.addUser('usr_a');
		harness.costs = [{ userId: 'usr_a', costMicroUsd: OVER_BRAKE_COST_MICRO_USD }];

		await expect(guard(deps, requestFor('usr_a'))).rejects.toMatchObject({
			code: 'SERVICE_LIMITED'
		});

		expect(brakeRow()?.value).toMatchObject({ day: '2026-10-11', active: true, releasedAt: null });
		expect(harness.sender.sent).toHaveLength(1);
		expect(eventsNamed(fixture.logger, 'protections.brake.activated')).toHaveLength(1);
	});

	it('mientras está activo rechaza sin volver a sumar el día ni avisar otra vez', async () => {
		const deps = harness.deps;
		fixture.addUser('usr_a');
		harness.costs = [{ userId: 'usr_a', costMicroUsd: OVER_BRAKE_COST_MICRO_USD }];
		await expect(guard(deps, requestFor('usr_a'))).rejects.toMatchObject({
			code: 'SERVICE_LIMITED'
		});

		await expect(guard(deps, requestFor('usr_a'))).rejects.toMatchObject({
			code: 'SERVICE_LIMITED'
		});

		expect(harness.costCalls()).toBe(1);
		expect(harness.sender.sent).toHaveLength(1);
	});

	it('el coste de las cuentas con compra real no cuenta para el freno (BE-FR-46 CA1)', async () => {
		const deps = harness.deps;
		fixture.credits.grantWelcome({
			userId: fixture.addUser('usr_pagadora'),
			emailNormalizedHash: 'h-pagadora'
		});
		markRealPurchase(fixture.db, 'usr_pagadora');
		harness.costs = [{ userId: 'usr_pagadora', costMicroUsd: OVER_BRAKE_COST_MICRO_USD }];

		await expect(guard(deps, requestFor('usr_pagadora'))).resolves.toBeTypeOf('function');

		expect(brakeRow()).toBeUndefined();
		expect(harness.sender.sent).toHaveLength(0);
	});

	it('al cambiar de día del calendario de Madrid vuelve a estar libre', async () => {
		const deps = harness.deps;
		fixture.addUser('usr_a');
		harness.costs = [{ userId: 'usr_a', costMicroUsd: OVER_BRAKE_COST_MICRO_USD }];
		await expect(guard(deps, requestFor('usr_a'))).rejects.toMatchObject({
			code: 'SERVICE_LIMITED'
		});

		// 2026-10-11 22:30 UTC es 00:30 del 12 en Madrid: día nuevo, sin coste.
		fixture.clock.set(Date.UTC(2026, 9, 11, 22, 30, 0));
		harness.costs = [];

		await expect(guard(deps, requestFor('usr_a'))).resolves.toBeTypeOf('function');
		await guard(deps, requestFor('usr_a'));
		expect(eventsNamed(fixture.logger, 'protections.brake.released')).toHaveLength(1);
		expect(eventsNamed(fixture.logger, 'protections.brake.released')[0]?.fields).toEqual({
			reason: 'new_day'
		});
	});

	it('la liberación manual deja auditoría, no vuelve a saltar ese día y solo se puede liberar una vez', async () => {
		const deps = harness.deps;
		fixture.addUser('usr_a');
		const adminId = fixture.addUser('adm_a', 'admin');
		harness.costs = [{ userId: 'usr_a', costMicroUsd: OVER_BRAKE_COST_MICRO_USD }];
		await expect(guard(deps, requestFor('usr_a'))).rejects.toMatchObject({
			code: 'SERVICE_LIMITED'
		});
		const releaseDeps = {
			db: fixture.db,
			clock: fixture.clock,
			logger: fixture.logger,
			audit: { clock: fixture.clock, ids: createIdGenerator(), logger: fixture.logger }
		};

		expect(releaseBrake(releaseDeps, adminId)).toBe(true);
		expect(releaseBrake(releaseDeps, adminId)).toBe(false);

		expect(brakeRow()?.value).toMatchObject({ active: false, releasedBy: adminId });
		expect(
			fixture.db
				.select()
				.from(adminAudit)
				.where(eq(adminAudit.action, 'protections.brake.released'))
				.all()
		).toHaveLength(1);
		await expect(guard(deps, requestFor('usr_a'))).resolves.toBeTypeOf('function');
	});
});
