// Restricciones de las tablas de `credits` y disparadores del ledger contra SQLite real (T116; data-model.md 2.6 y 1.5).
// La plantilla de pruebas se migra desde cero en el _global setup_, así que cada prueba ya parte de una migración sobre
// base vacía.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { toMicro } from '$lib/shared/money';
import { toEpochMs } from '$lib/shared/time';
import { creditBuckets, creditMovements, welcomeGrants } from './schema';

let fixture: CreditsFixture;
let userId: string;

beforeEach(() => {
	fixture = creditsFixture(Date.UTC(2026, 9, 11, 8, 0, 0));
	userId = fixture.addUser('usr_schema');
});

afterEach(() => {
	fixture.close();
});

function bucket(
	overrides: Partial<typeof creditBuckets.$inferInsert> = {}
): typeof creditBuckets.$inferInsert {
	const row: typeof creditBuckets.$inferInsert = {
		id: `bkt_${String(Math.random()).slice(2, 10)}`,
		userId,
		kind: 'free',
		source: 'adjustment',
		initialMicro: toMicro(1_000_000),
		remainingMicro: toMicro(1_000_000),
		expiresAt: toEpochMs(Date.UTC(2026, 10, 11))
	};
	return { ...row, ...overrides };
}

describe('restricciones de credit_buckets (data-model 2.6)', () => {
	it('una bolsa gratuita sin caducidad no entra', () => {
		expect(() =>
			fixture.db
				.insert(creditBuckets)
				.values(bucket({ expiresAt: null }))
				.run()
		).toThrow();
	});

	it('una bolsa de pago con caducidad no entra', () => {
		expect(() =>
			fixture.db
				.insert(creditBuckets)
				.values(bucket({ kind: 'paid', source: 'adjustment' }))
				.run()
		).toThrow();
	});

	it('el saldo restante no puede superar el inicial ni ser negativo', () => {
		expect(() =>
			fixture.db
				.insert(creditBuckets)
				.values(bucket({ remainingMicro: toMicro(2_000_000) }))
				.run()
		).toThrow();
	});

	it('una sola bolsa de bienvenida por cuenta (índice parcial)', () => {
		fixture.db
			.insert(creditBuckets)
			.values(bucket({ source: 'welcome' }))
			.run();

		expect(() =>
			fixture.db
				.insert(creditBuckets)
				.values(bucket({ source: 'welcome' }))
				.run()
		).toThrow();
	});
});

describe('restricciones de credit_movements y disparadores (append-only)', () => {
	function movement(
		overrides: Partial<typeof creditMovements.$inferInsert> = {}
	): typeof creditMovements.$inferInsert {
		const row: typeof creditMovements.$inferInsert = {
			id: `mov_${String(Math.random()).slice(2, 10)}`,
			userId,
			type: 'expiry',
			amountMicro: toMicro(-1),
			bucketId: null
		};
		return { ...row, ...overrides };
	}

	it('un movimiento de importe cero no entra', () => {
		expect(() =>
			fixture.db
				.insert(creditMovements)
				.values(movement({ amountMicro: toMicro(0) }))
				.run()
		).toThrow();
	});

	it('una caducidad sin bolsa no entra', () => {
		expect(() =>
			fixture.db
				.insert(creditMovements)
				.values(movement({ bucketId: null }))
				.run()
		).toThrow();
	});

	/** Una bolsa real y un movimiento `expiry` sobre ella: la forma mínima válida del ledger. */
	function validMovement(): typeof creditMovements.$inferInsert {
		const bucketId = `bkt_ledger_${String(Math.random()).slice(2, 10)}`;
		fixture.db
			.insert(creditBuckets)
			.values(bucket({ id: bucketId, remainingMicro: toMicro(0) }))
			.run();
		return movement({ bucketId, amountMicro: toMicro(-1_000_000) });
	}

	it('un movimiento no se puede modificar', () => {
		const row = validMovement();
		fixture.db.insert(creditMovements).values(row).run();
		expect(() =>
			fixture.db
				.update(creditMovements)
				.set({ amountMicro: toMicro(-2) })
				.where(eq(creditMovements.id, row.id))
				.run()
		).toThrow(/append-only/);
	});

	it('un movimiento no se puede borrar', () => {
		const row = validMovement();
		fixture.db.insert(creditMovements).values(row).run();
		expect(() =>
			fixture.db.delete(creditMovements).where(eq(creditMovements.id, row.id)).run()
		).toThrow(/append-only/);
	});
});

describe('marca de bienvenida por forma normalizada', () => {
	it('una forma solo puede aparecer una vez', () => {
		fixture.db.insert(welcomeGrants).values({ emailNormalizedHash: 'h1' }).run();

		expect(() =>
			fixture.db.insert(welcomeGrants).values({ emailNormalizedHash: 'h1' }).run()
		).toThrow();
	});
});
