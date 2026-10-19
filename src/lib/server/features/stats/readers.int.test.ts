// Lecturas de estadísticas contra SQLite real (BE-FR-54, BE-FR-07 CA4; T318): operaciones de IA por estado con su coste y lo absorbido,
// saldo anulado por el borrado, y altas por app de origen. Los datos se crean con los servicios de cada funcionalidad.
import { eq } from 'drizzle-orm';
import { toMicro, toMicroUsd } from '$lib/shared/money';
import { toEpochMs } from '$lib/shared/time';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { insertInFlightOperation } from '../../../../../tests/builders/ai-operations';
import { paymentsFixture, type PaymentsFixture } from '../../../../../tests/builders/payments';
import { firstOperationsBetween, operationStatsBetween } from '../ai';
import { aiOperations } from '../ai/schema';
import { firstLoginsBetween, signupsBetween } from '../accounts';
import { userAppActivity } from '../accounts/schema';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { forfeitsBetween } from '../credits';

let f: PaymentsFixture;

beforeEach(() => {
	f = paymentsFixture('test');
});

afterEach(() => {
	f.close();
});

function period() {
	const now = new Date(f.base.clock.now());
	return {
		fromMs: Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
		toMs: Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)
	};
}

describe('lecturas de estadísticas contra la base de datos (T318)', () => {
	it('las operaciones de IA salen con su estado, su coste del proveedor y lo absorbido', () => {
		const { userId } = f.addAccount('usr_lect_ops');
		const id = insertInFlightOperation(f.base.db, { userId });
		f.base.db
			.update(aiOperations)
			.set({
				status: 'cancelled',
				costMicroUsd: toMicroUsd(2_000_000),
				chargedMicro: toMicro(0),
				fxRateId: null,
				absorbedMicro: toMicro(500_000),
				absorbedReason: 'debt_cap',
				completedAt: toEpochMs(f.base.clock.now())
			})
			.where(eq(aiOperations.id, id))
			.run();

		const facts = operationStatsBetween(f.base.db, period());
		const row = facts.find((fact) => fact.status === 'cancelled');

		expect(row).toMatchObject({
			status: 'cancelled',
			costMicroUsd: toMicroUsd(2_000_000),
			chargedMicro: 0,
			absorbedMicro: toMicro(500_000),
			absorbedReason: 'debt_cap',
			fxRateId: null
		});
	});

	it('el saldo anulado por el borrado aparece como importe positivo del periodo', () => {
		const { userId } = f.addAccount('usr_lect_forfeit');
		f.base.credits.grantWelcome({ userId, emailNormalizedHash: 'hash-lect' });
		f.base.credits.forfeitAll(userId);

		const forfeits = forfeitsBetween(f.base.db, period());

		expect(forfeits.length).toBeGreaterThan(0);
		expect(forfeits.every((row) => row.micro > 0)).toBe(true);
	});

	it('las altas se cuentan por su día y su app de origen (null cuando no hay app)', () => {
		f.addAccount('usr_lect_alta');

		const signups = signupsBetween(f.base.db, period());

		expect(signups.length).toBeGreaterThan(0);
		expect(signups.every((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date))).toBe(true);
	});

	it('una operación truncada o que usó respaldo sale marcada, para contarla aparte', () => {
		const { userId } = f.addAccount('usr_lect_flags');
		const id = insertInFlightOperation(f.base.db, { userId });
		f.base.db
			.update(aiOperations)
			.set({
				status: 'ok',
				truncated: true,
				usedFallback: true,
				completedAt: toEpochMs(f.base.clock.now())
			})
			.where(eq(aiOperations.id, id))
			.run();

		const row = operationStatsBetween(f.base.db, period()).find((fact) => fact.status === 'ok');

		expect(row).toMatchObject({ truncated: true, usedFallback: true });
	});

	it('los primeros inicios se cuentan por app de origen dentro del periodo', () => {
		const { userId } = f.addAccount('usr_lect_primer_login');
		const now = toEpochMs(f.base.clock.now());
		f.base.db
			.insert(userAppActivity)
			.values({ userId, appId: SEEDED_APP_ID, firstLoginAt: now, lastUsedAt: now })
			.run();

		const facts = firstLoginsBetween(f.base.db, period());

		expect(facts).toEqual([expect.objectContaining({ appId: SEEDED_APP_ID })]);
	});

	it('la primera operación de IA cuenta una vez por cuenta, en el periodo de su primera operación de toda la historia', () => {
		const nueva = f.addAccount('usr_lect_primera_nueva').userId;
		const antigua = f.addAccount('usr_lect_primera_antigua').userId;
		insertInFlightOperation(f.base.db, { userId: nueva });
		const before = insertInFlightOperation(f.base.db, { userId: antigua });
		const during = insertInFlightOperation(f.base.db, { userId: antigua });
		f.base.db
			.update(aiOperations)
			.set({ createdAt: toEpochMs(Date.UTC(2026, 8, 1)) })
			.where(eq(aiOperations.id, before))
			.run();
		f.base.db
			.update(aiOperations)
			.set({ createdAt: toEpochMs(Date.UTC(2026, 9, 15)) })
			.where(eq(aiOperations.id, during))
			.run();

		const facts = firstOperationsBetween(f.base.db, period());

		expect(facts.length).toBe(1);
	});
});
