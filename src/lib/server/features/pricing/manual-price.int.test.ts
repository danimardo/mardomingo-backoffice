// Valor manual del precio orientativo contra SQLite real (BE-FR-73; W38; T309): fijar, que el cálculo posterior no lo borra, quitarlo, y
// la auditoría con el valor anterior y el nuevo. Las operaciones se crean con su builder, por la clave foránea.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addOperation, appsTestContext, chatOperation } from '../../../../../tests/builders/apps';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { adminAudit } from '../audit/schema';
import { savePriceReference } from './service';
import { priceReferences } from './schema';
import { setManualPrice } from './service';
import { eq } from 'drizzle-orm';
import { createIdGenerator } from '$lib/server/shared/ids';

let f: CreditsFixture;
let adminId: string;
let operationId: string;

beforeEach(() => {
	f = creditsFixture(Date.UTC(2026, 9, 18, 9, 0, 0));
	adminId = f.addUser('usr_admin_precios');
	operationId = addOperation(
		appsTestContext(f.db, 81),
		SEEDED_APP_ID,
		chatOperation('op_manual_precio')
	);
});

afterEach(() => {
	f.close();
});

function deps() {
	return {
		db: f.db,
		logger: f.logger,
		clock: f.clock,
		audit: { clock: f.clock, ids: createIdGenerator(), logger: f.logger }
	};
}

describe('precio orientativo manual (BE-FR-73)', () => {
	it('fijar un valor manual no borra el calculado y deja auditoría', () => {
		savePriceReference(
			{ db: f.db },
			{ operationId, typicalMicro: 150, source: 'auto', sampleSize: 4, computedAt: f.clock.now() }
		);

		setManualPrice(deps(), { adminId, operationId, microUsd: 900, reason: 'precio acordado' });

		expect(
			f.db.select().from(priceReferences).where(eq(priceReferences.operationId, operationId)).get()
		).toMatchObject({
			typicalMicro: 150,
			source: 'auto',
			manualTypicalMicro: 900
		});
		expect(
			f.db
				.select()
				.from(adminAudit)
				.all()
				.filter((row) => row.action === 'pricing.price.manual')
		).toEqual([
			expect.objectContaining({
				action: 'pricing.price.manual',
				entityId: operationId,
				reason: 'precio acordado'
			})
		]);
	});

	it('quitar el manual lo borra y el calculado sigue', () => {
		savePriceReference(
			{ db: f.db },
			{ operationId, typicalMicro: 150, source: 'auto', sampleSize: 4, computedAt: f.clock.now() }
		);
		setManualPrice(deps(), { adminId, operationId, microUsd: 900, reason: 'x' });

		setManualPrice(deps(), { adminId, operationId, microUsd: null, reason: 'ya no' });

		expect(
			f.db.select().from(priceReferences).where(eq(priceReferences.operationId, operationId)).get()
				?.manualTypicalMicro
		).toBeNull();
		expect(
			f.db.select().from(priceReferences).where(eq(priceReferences.operationId, operationId)).get()
				?.typicalMicro
		).toBe(150);
	});

	it('sin motivo o con un importe negativo no escribe nada', () => {
		expect(() => { setManualPrice(deps(), { adminId, operationId, microUsd: 5, reason: '  ' }); }
		).toThrow();
		expect(() => { setManualPrice(deps(), { adminId, operationId, microUsd: -5, reason: 'x' }); }
		).toThrow();
		expect(f.db.select().from(priceReferences).all()).toEqual([]);
	});
});
