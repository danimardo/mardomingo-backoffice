// Aviso de saldo bajo contra SQLite real (T254; BE-FR-49.7): avisa una sola vez al cruzar el umbral hacia abajo, no repite
// mientras siga por debajo y se rearma al superarlo. Con el umbral nulo no hay aviso.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { insertInFlightOperation } from '../../../../../tests/builders/ai-operations';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { toMicro } from '$lib/shared/money';
import { userBalances } from './schema';

const CREDIT = 1_000_000;

let f: CreditsFixture;
let userId: string;

beforeEach(() => {
	f = creditsFixture(Date.UTC(2026, 9, 11, 8, 0, 0));
	userId = f.addUser('usr_aviso');
	f.credits.grantWelcome({ userId, emailNormalizedHash: 'hash-aviso' });
});

afterEach(() => {
	f.close();
});

/** Fija el umbral de saldo bajo de la cuenta; sin llamar, el aviso queda desactivado (valor por defecto nulo). */
function setThreshold(micro: number): void {
	f.db
		.update(userBalances)
		.set({ lowBalanceThresholdMicro: toMicro(micro) })
		.where(eq(userBalances.userId, userId))
		.run();
}

function charge(realCreditsCost: number) {
	const reserved = f.credits.reserve({
		userId,
		appId: SEEDED_APP_ID,
		operationId: insertInFlightOperation(f.db, { userId }),
		amountMicro: 1 * CREDIT
	});
	if (!reserved.ok) throw new Error('la reserva debía caber');
	return f.credits.chargeAndRelease({
		holdId: reserved.holdId,
		realCostMicro: realCreditsCost * CREDIT
	});
}

describe('aviso de saldo bajo (BE-FR-49.7)', () => {
	it('avisa una sola vez al cruzar el umbral hacia abajo y lo marca', () => {
		setThreshold(900 * CREDIT);

		const first = charge(200);
		const second = charge(200);

		expect(first).toMatchObject({ lowBalance: 'notified' });
		expect(second).toMatchObject({ lowBalance: null });
		expect(eventsNamed(f.logger, 'credits.low_balance.crossed')).toEqual([
			expect.objectContaining({ fields: { status: 'notified' } })
		]);
		expect(
			f.db.select().from(userBalances).where(eq(userBalances.userId, userId)).get()
				?.lowBalanceNotified
		).toBe(true);
	});

	it('al superar el umbral, se rearma para poder avisar otra vez', () => {
		setThreshold(900 * CREDIT);
		charge(200);
		charge(200);

		f.credits.adjust({
			adminId: f.addUser('adm_aviso', 'admin'),
			userId,
			direction: 'credit',
			kind: 'paid',
			amountMicro: 5_000 * CREDIT,
			reason: 'recarga de prueba'
		});

		expect(eventsNamed(f.logger, 'credits.low_balance.crossed')).toEqual(
			expect.arrayContaining([expect.objectContaining({ fields: { status: 'rearmed' } })])
		);
		expect(
			f.db.select().from(userBalances).where(eq(userBalances.userId, userId)).get()
				?.lowBalanceNotified
		).toBe(false);
	});

	it('con el umbral desactivado, no hay aviso', () => {
		expect(charge(200)).toMatchObject({ lowBalance: null });
		expect(eventsNamed(f.logger, 'credits.low_balance.crossed')).toEqual([]);
	});
});
