// Restricciones de `price_references` contra SQLite real (BE-FR-73; data-model 2.5; T298): el coste típico y su origen van
// juntos, los importes no son negativos y cada operación tiene a lo sumo una referencia.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { appsTestContext, addOperation, chatOperation } from '../../../../../tests/builders/apps';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { toMicro } from '$lib/shared/money';
import { priceReferences } from './schema';

let fixture: CreditsFixture;
let operationId: string;

beforeEach(() => {
	fixture = creditsFixture(Date.UTC(2026, 9, 11, 8, 0, 0));
	const ctx = appsTestContext(fixture.db);
	operationId = addOperation(ctx, SEEDED_APP_ID, chatOperation('op_precio'));
});

afterEach(() => {
	fixture.close();
});

function row(overrides: Partial<typeof priceReferences.$inferInsert> = {}) {
	return { operationId, sampleSize: 0, ...overrides };
}

describe('restricciones de price_references (data-model 2.5)', () => {
	it('una referencia sin valor ni origen es válida: la operación aún no tiene coste típico', () => {
		expect(() => fixture.db.insert(priceReferences).values(row()).run()).not.toThrow();
	});

	it('un valor automático necesita su origen y viceversa', () => {
		expect(() =>
			fixture.db
				.insert(priceReferences)
				.values(row({ typicalMicro: toMicro(120_000) }))
				.run()
		).toThrow();
		expect(() =>
			fixture.db
				.insert(priceReferences)
				.values(row({ source: 'auto' }))
				.run()
		).toThrow();
	});

	it('el origen solo puede ser auto o manual', () => {
		expect(() =>
			fixture.database.sqlite
				.prepare(
					'INSERT INTO price_references (operation_id, typical_micro, source) VALUES (?, ?, ?)'
				)
				.run(operationId, 1, 'otro')
		).toThrow();
	});

	it('ningún importe puede ser negativo y las muestras tampoco', () => {
		expect(() =>
			fixture.db
				.insert(priceReferences)
				.values(row({ typicalMicro: toMicro(-1), source: 'auto' }))
				.run()
		).toThrow();
		expect(() =>
			fixture.db
				.insert(priceReferences)
				.values(row({ manualTypicalMicro: toMicro(-5) }))
				.run()
		).toThrow();
		expect(() =>
			fixture.db
				.insert(priceReferences)
				.values(row({ sampleSize: -1 }))
				.run()
		).toThrow();
	});

	it('el valor manual sobrevive a un recálculo automático: son columnas distintas', () => {
		fixture.db
			.insert(priceReferences)
			.values(
				row({ typicalMicro: toMicro(100_000), source: 'auto', manualTypicalMicro: toMicro(90_000) })
			)
			.run();

		const stored = fixture.db.select().from(priceReferences).get();
		expect(stored?.typicalMicro).toBe(toMicro(100_000));
		expect(stored?.manualTypicalMicro).toBe(toMicro(90_000));
	});

	it('una operación tiene a lo sumo una referencia (clave primaria)', () => {
		fixture.db.insert(priceReferences).values(row()).run();

		expect(() => fixture.db.insert(priceReferences).values(row()).run()).toThrow();
	});

	it('no admite una operación que no existe (clave foránea)', () => {
		expect(() =>
			fixture.db
				.insert(priceReferences)
				.values(row({ operationId: 'aop_inexistente' }))
				.run()
		).toThrow();
	});
});
