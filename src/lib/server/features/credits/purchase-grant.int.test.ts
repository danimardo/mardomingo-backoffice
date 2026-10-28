// Acreditación de compras, retirada por reembolso y contracargo contra SQLite real (T232; BE-FR-24/CA1, BE-FR-25/CA3,
// BE-FR-27, BE-FR-28): la compra liquida primero la deuda, no acredita dos veces, la simulada no fija `has_real_purchase`,
// el reembolso retira de la bolsa de esa compra y el contracargo retira lo que quede y pasa el resto a deuda sin tope.
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { insertInFlightOperation } from '../../../../../tests/builders/ai-operations';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import { insertCompletedPurchase } from '../../../../../tests/builders/purchases';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { immediateTransaction } from '$lib/server/db/tx';
import type { LineType } from './domain/ledger';
import type { RefundWithdrawOutcome } from './index';
import { creditBuckets, creditMovements, userBalances } from './schema';

const CREDIT = 1_000_000;
const NOW = Date.UTC(2026, 9, 11, 8, 0, 0);

let f: CreditsFixture;

beforeEach(() => {
	f = creditsFixture(NOW);
});

afterEach(() => {
	f.close();
});

/** Registra la compra en la tabla de pagos y acredita su bolsa, como hará `payments` al completar el pago. */
function buy(userId: string, paymentId: string, creditsCount: number, simulated = false) {
	insertCompletedPurchase(f.db, {
		paymentId,
		userId,
		creditsMicro: creditsCount * CREDIT,
		simulated,
		now: NOW
	});
	return f.credits.grantPurchase({
		userId,
		paymentId,
		amountMicro: creditsCount * CREDIT,
		simulated
	});
}

function bucketOf(paymentId: string) {
	return f.db.select().from(creditBuckets).where(eq(creditBuckets.paymentId, paymentId)).all();
}

function movementsOf(paymentId: string, type: LineType) {
	return f.db
		.select()
		.from(creditMovements)
		.where(and(eq(creditMovements.paymentId, paymentId), eq(creditMovements.type, type)))
		.all();
}

function balanceRow(userId: string) {
	return f.db.select().from(userBalances).where(eq(userBalances.userId, userId)).get();
}

describe('acreditación de una compra (BE-FR-24/CA1, BE-FR-25/CA3)', () => {
	it('liquida primero la deuda: movimientos debt_settlement y purchase, bolsa paid con payment_id y evento', () => {
		const userId = f.addUser('usr_deuda');
		expect(buy(userId, 'pay_inicial', 1000)).toEqual({ status: 'granted' });
		const reserved = f.credits.reserve({
			userId,
			appId: SEEDED_APP_ID,
			operationId: insertInFlightOperation(f.db, { userId }),
			amountMicro: 1000 * CREDIT
		});
		if (!reserved.ok) throw new Error('la reserva debía caber');
		f.credits.chargeAndRelease({ holdId: reserved.holdId, realCostMicro: 1100 * CREDIT });
		expect(balanceRow(userId)?.debtMicro).toBe(100 * CREDIT);

		expect(buy(userId, 'pay_grande', 10_500)).toEqual({ status: 'granted' });

		expect(balanceRow(userId)?.debtMicro).toBe(0);
		const [bucket] = bucketOf('pay_grande');
		expect(bucket).toMatchObject({
			kind: 'paid',
			source: 'purchase',
			initialMicro: 10_500 * CREDIT,
			remainingMicro: 10_400 * CREDIT,
			simulated: false
		});
		expect(movementsOf('pay_grande', 'purchase')).toHaveLength(1);
		expect(movementsOf('pay_grande', 'debt_settlement')).toHaveLength(2);
		expect(eventsNamed(f.logger, 'credits.debt.settled')).toHaveLength(1);
	});

	it('una compra real fija has_real_purchase; la simulada no lo cambia', () => {
		const real = f.addUser('usr_real');
		const simulated = f.addUser('usr_sim');
		buy(real, 'pay_real', 100);
		buy(simulated, 'pay_sim', 100, true);

		expect(balanceRow(real)?.hasRealPurchase).toBe(true);
		expect(balanceRow(simulated)?.hasRealPurchase ?? false).toBe(false);
		expect(bucketOf('pay_sim')[0]?.simulated).toBe(true);
	});

	it('un segundo intento con el mismo pago no acredita otra vez', () => {
		const userId = f.addUser('usr_doble');
		buy(userId, 'pay_unico', 500);

		const again = f.credits.grantPurchase({
			userId,
			paymentId: 'pay_unico',
			amountMicro: 500 * CREDIT,
			simulated: false
		});

		expect(again).toEqual({ status: 'already_granted' });
		expect(bucketOf('pay_unico')).toHaveLength(1);
		expect(movementsOf('pay_unico', 'purchase')).toHaveLength(1);
	});
});

describe('reembolso: retirada de la bolsa de la compra (BE-FR-27)', () => {
	it('retira créditos de la bolsa de esa compra con movimiento refund y motivo de administrador', () => {
		const userId = f.addUser('usr_reembolso');
		const adminId = f.addUser('adm_reembolso', 'admin');
		buy(userId, 'pay_reembolso', 10_500);

		const outcome = f.credits.withdrawForRefund({
			adminId,
			userId,
			paymentId: 'pay_reembolso',
			amountMicro: 2000 * CREDIT,
			reason: 'reembolso solicitado por el cliente'
		});

		expect(outcome).toEqual({ ok: true });
		expect(bucketOf('pay_reembolso')[0]?.remainingMicro).toBe(8500 * CREDIT);
		expect(movementsOf('pay_reembolso', 'refund')).toEqual([
			expect.objectContaining({
				amountMicro: -2000 * CREDIT,
				adminId,
				adminReason: 'reembolso solicitado por el cliente'
			})
		]);
		expect(eventsNamed(f.logger, 'credits.refund.applied')).toHaveLength(1);
	});

	it('no retira más de lo que queda en la bolsa de la compra', () => {
		const userId = f.addUser('usr_exceso');
		const adminId = f.addUser('adm_exceso', 'admin');
		buy(userId, 'pay_exceso', 10_500);

		const outcome = f.credits.withdrawForRefund({
			adminId,
			userId,
			paymentId: 'pay_exceso',
			amountMicro: 10_501 * CREDIT,
			reason: 'reembolso excesivo'
		});

		expect(outcome).toEqual({ ok: false, reason: 'credits_exceed_bucket' });
		expect(bucketOf('pay_exceso')[0]?.remainingMicro).toBe(10_500 * CREDIT);
		expect(movementsOf('pay_exceso', 'refund')).toEqual([]);
	});

	// R12: con `tx`, la retirada va en la transacción de quien llama y se deshace si esa transacción falla.
	it('con una transacción compartida, la retirada se deshace junto con ella', () => {
		const userId = f.addUser('usr_tx_compartida');
		const adminId = f.addUser('adm_tx_compartida', 'admin');
		buy(userId, 'pay_tx_compartida', 10_500);
		let outcome: RefundWithdrawOutcome | undefined;

		expect(() =>
			immediateTransaction(f.db, (tx) => {
				outcome = f.credits.withdrawForRefund({
					tx,
					adminId,
					userId,
					paymentId: 'pay_tx_compartida',
					amountMicro: 2000 * CREDIT,
					reason: 'reembolso con transacción compartida'
				});
				throw new Error('fallo posterior en la transacción de quien llama');
			})
		).toThrow('fallo posterior');

		expect(outcome).toEqual({ ok: true });
		expect(bucketOf('pay_tx_compartida')[0]?.remainingMicro).toBe(10_500 * CREDIT);
		expect(movementsOf('pay_tx_compartida', 'refund')).toEqual([]);
	});
});

describe('contracargo (BE-FR-28, H-12)', () => {
	it('retira lo que quede de la bolsa, pasa el resto a deuda sin tope y no se repite', () => {
		const userId = f.addUser('usr_contracargo');
		const adminId = f.addUser('adm_contracargo', 'admin');
		buy(userId, 'pay_contracargo', 10_500);
		f.credits.withdrawForRefund({
			adminId,
			userId,
			paymentId: 'pay_contracargo',
			amountMicro: 2000 * CREDIT,
			reason: 'reembolso previo'
		});
		const reserved = f.credits.reserve({
			userId,
			appId: SEEDED_APP_ID,
			operationId: insertInFlightOperation(f.db, { userId }),
			amountMicro: 8000 * CREDIT
		});
		if (!reserved.ok) throw new Error('la reserva debía caber');
		f.credits.chargeAndRelease({ holdId: reserved.holdId, realCostMicro: 8000 * CREDIT });
		// Quedan 500 en la bolsa; el contracargo recupera 10.500 − 2.000 = 8.500 créditos.

		const first = f.credits.applyChargeback({ userId, paymentId: 'pay_contracargo' });
		const second = f.credits.applyChargeback({ userId, paymentId: 'pay_contracargo' });

		expect(first).toEqual({
			status: 'applied',
			withdrawnMicro: 500 * CREDIT,
			debtAddedMicro: 8000 * CREDIT
		});
		expect(second).toEqual({ status: 'already_applied' });
		expect(balanceRow(userId)?.debtMicro).toBe(8000 * CREDIT);
		expect(bucketOf('pay_contracargo')[0]?.remainingMicro).toBe(0);
		// Dos movimientos: lo retirado de la bolsa y lo que pasa a deuda (sin bolsa).
		const bucketId = bucketOf('pay_contracargo')[0]?.id;
		expect(movementsOf('pay_contracargo', 'chargeback')).toEqual([
			expect.objectContaining({ amountMicro: -500 * CREDIT, bucketId }),
			expect.objectContaining({ amountMicro: -8000 * CREDIT, bucketId: null })
		]);
		expect(eventsNamed(f.logger, 'credits.chargeback.applied')).toHaveLength(1);
	});
});
