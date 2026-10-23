// Reembolsos y contracargos contra SQLite real (T235; BE-FR-27, BE-FR-28): reembolso manual con motivo y auditoría, rechazo
// cuando lo pagado ya no está en la bolsa, y contracargo que retira el saldo, pasa el resto a deuda sin tope, bloquea la
// cuenta y no se repite con un evento repetido.
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { insertInFlightOperation } from '../../../../../tests/builders/ai-operations';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import { markRealPurchase } from '../../../../../tests/builders/purchases';
import { paymentsFixture, type PaymentsFixture } from '../../../../../tests/builders/payments';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { adminAudit } from '$lib/server/features/audit/schema';
import { creditMovements, userBalances } from '$lib/server/features/credits/schema';
import { session, user } from '$lib/server/features/accounts/schema';
import { termsAcceptances } from '$lib/server/features/legal/schema';
import { payments } from './schema';

const CREDIT = 1_000_000;
const PACK_10 = 'pck_seed_10eur';

let f: PaymentsFixture;

beforeEach(() => {
	f = paymentsFixture('test');
});

afterEach(() => {
	f.close();
});

function errorOf(run: () => unknown): unknown {
	try {
		run();
	} catch (error) {
		return error;
	}
	throw new Error('se esperaba un error y no se lanzó ninguno');
}

/** Compra de 10 € con la renuncia vigente de la propia cuenta. */
function buy(userId: string, attemptId: string): string {
	const waiver = f.base.db
		.select({ id: termsAcceptances.id })
		.from(termsAcceptances)
		.where(
			and(eq(termsAcceptances.userId, userId), eq(termsAcceptances.document, 'withdrawal_waiver'))
		)
		.get();
	if (waiver === undefined) throw new Error('la cuenta debía tener su renuncia');
	const outcome = f.payments.purchase({
		userId,
		role: 'user',
		attemptId,
		packId: PACK_10,
		wantsFullInvoice: false,
		withdrawalAcceptanceId: waiver.id
	});
	if (outcome.status !== 'completed') throw new Error('la compra debía completarse');
	return outcome.paymentId;
}

function paymentOf(paymentId: string) {
	return f.base.db.select().from(payments).where(eq(payments.id, paymentId)).get();
}

describe('reembolso manual (BE-FR-27)', () => {
	it('reembolso total: movimiento refund, importe devuelto, estado, auditoría y evento', () => {
		const { userId } = f.addAccount('usr_reembolso');
		const adminId = f.addAccount('adm_reembolso', 'admin').userId;
		const paymentId = buy(userId, 'att_reembolso');

		const outcome = f.payments.refund({
			adminId,
			paymentId,
			amountEurCents: 1000,
			reason: 'El cliente lo pidió en plazo'
		});

		expect(outcome).toEqual({ status: 'refunded', refundedEurCents: 1000 });
		expect(paymentOf(paymentId)).toMatchObject({ status: 'refunded', refundedEurCents: 1000 });
		expect(
			f.base.db.select().from(creditMovements).where(eq(creditMovements.type, 'refund')).all()
		).toEqual([expect.objectContaining({ amountMicro: -10_500 * CREDIT, paymentId, adminId })]);
		expect(f.base.credits.getBalance(userId).totalMicro).toBe(0);
		expect(f.base.db.select().from(adminAudit).all()).toEqual([
			expect.objectContaining({ adminId, action: 'payments.refund', entityId: paymentId })
		]);
		expect(eventsNamed(f.base.logger, 'payments.refund.applied')).toHaveLength(1);
	});

	it('reembolso parcial: estado partially_refunded y retirada proporcional', () => {
		const { userId } = f.addAccount('usr_parcial');
		const adminId = f.addAccount('adm_parcial', 'admin').userId;
		const paymentId = buy(userId, 'att_parcial');

		const outcome = f.payments.refund({
			adminId,
			paymentId,
			amountEurCents: 500,
			reason: 'Parte del pack'
		});

		expect(outcome).toEqual({ status: 'partially_refunded', refundedEurCents: 500 });
		expect(paymentOf(paymentId)).toMatchObject({
			status: 'partially_refunded',
			refundedEurCents: 500
		});
		expect(f.base.credits.getBalance(userId).totalMicro).toBe(5250 * CREDIT);
	});

	it('no se reembolsa más de lo no consumido: PAYMENT_NOT_REFUNDABLE y nada cambia', () => {
		const { userId } = f.addAccount('usr_consumido');
		const adminId = f.addAccount('adm_consumido', 'admin').userId;
		const paymentId = buy(userId, 'att_consumido');
		markRealPurchase(f.base.db, userId);
		const reserved = f.base.credits.reserve({
			userId,
			appId: SEEDED_APP_ID,
			operationId: insertInFlightOperation(f.base.db, { userId }),
			amountMicro: 10_000 * CREDIT
		});
		if (!reserved.ok) throw new Error('la reserva debía caber');
		f.base.credits.chargeAndRelease({ holdId: reserved.holdId, realCostMicro: 10_000 * CREDIT });

		const error = errorOf(() =>
			f.payments.refund({ adminId, paymentId, amountEurCents: 1000, reason: 'Ya consumido' })
		);

		expect(error).toMatchObject({ code: 'PAYMENT_NOT_REFUNDABLE' });
		expect(paymentOf(paymentId)).toMatchObject({ status: 'completed', refundedEurCents: 0 });
		expect(f.base.credits.getBalance(userId).totalMicro).toBe(500 * CREDIT);
		expect(eventsNamed(f.base.logger, 'payments.refund.rejected')).toHaveLength(1);
	});

	it('el motivo es obligatorio', () => {
		const { userId } = f.addAccount('usr_sin_motivo');
		const adminId = f.addAccount('adm_sin_motivo', 'admin').userId;
		const paymentId = buy(userId, 'att_sin_motivo');

		expect(
			errorOf(() => f.payments.refund({ adminId, paymentId, amountEurCents: 1000, reason: '   ' }))
		).toMatchObject({ code: 'VALIDATION_ERROR' });
		expect(paymentOf(paymentId)).toMatchObject({ status: 'completed' });
	});
});

describe('contracargo (BE-FR-28)', () => {
	it('retira el saldo restante, pasa el resto a deuda sin tope, bloquea la cuenta y no se repite', () => {
		const { userId } = f.addAccount('usr_contracargo');
		const paymentId = buy(userId, 'att_contracargo');
		markRealPurchase(f.base.db, userId);
		const reserved = f.base.credits.reserve({
			userId,
			appId: SEEDED_APP_ID,
			operationId: insertInFlightOperation(f.base.db, { userId }),
			amountMicro: 8000 * CREDIT
		});
		if (!reserved.ok) throw new Error('la reserva debía caber');
		f.base.credits.chargeAndRelease({ holdId: reserved.holdId, realCostMicro: 8000 * CREDIT });
		const providerRef = `fake_${paymentId}`;
		f.base.db
			.insert(session)
			.values({
				id: 'ses_contracargo',
				userId,
				token: 'tok_contracargo',
				expiresAt: new Date(f.base.clock.now() + 86_400_000),
				createdAt: new Date(f.base.clock.now()),
				updatedAt: new Date(f.base.clock.now())
			})
			.run();

		f.payments.handleProviderEvents({ type: 'chargeback_opened', providerRef });
		f.payments.handleProviderEvents({ type: 'chargeback_opened', providerRef });

		// Quedaban 2.500 créditos en la bolsa: se retiran y el resto (10.500 − 2.500 = 8.000) pasa a deuda, sin tope.
		expect(
			f.base.db.select().from(userBalances).where(eq(userBalances.userId, userId)).get()?.debtMicro
		).toBe(8000 * CREDIT);
		expect(paymentOf(paymentId)).toMatchObject({ status: 'chargeback' });
		expect(f.base.db.select().from(user).where(eq(user.id, userId)).get()).toMatchObject({
			banned: true,
			banReason: 'chargeback'
		});
		expect(
			f.base.db.select().from(creditMovements).where(eq(creditMovements.type, 'chargeback')).all()
		).toHaveLength(2);
		expect(f.base.db.select().from(session).where(eq(session.userId, userId)).all()).toHaveLength(
			0
		);
		expect(eventsNamed(f.base.logger, 'payments.chargeback.applied')).toHaveLength(1);
		expect(eventsNamed(f.base.logger, 'payments.webhook.duplicate')).toHaveLength(1);
	});

	it('un contracargo sobre una compra sin acreditar no bloquea la cuenta ni cambia nada', () => {
		const { userId } = f.addAccount('usr_contracargo_pendiente');
		const paymentId = buy(userId, 'att_contracargo_pendiente');
		f.base.db
			.update(payments)
			.set({ status: 'pending', completedAt: null })
			.where(eq(payments.id, paymentId))
			.run();

		f.payments.handleProviderEvents({
			type: 'chargeback_opened',
			providerRef: `fake_${paymentId}`
		});

		expect(paymentOf(paymentId)).toMatchObject({ status: 'pending' });
		expect(f.base.db.select().from(user).where(eq(user.id, userId)).get()?.banned).toBe(false);
		expect(eventsNamed(f.base.logger, 'payments.webhook.rejected')).toHaveLength(1);
		expect(eventsNamed(f.base.logger, 'payments.chargeback.applied')).toHaveLength(0);
	});
});

describe('vista previa del reembolso (T308)', () => {
	it('calcula los créditos a retirar en proporción al importe, sin escribir nada', () => {
		const { userId } = f.addAccount('usr_vista_previa');
		const paymentId = buy(userId, 'att_vista_previa');
		const creditsMicro = f.payments.purchaseOf(userId, paymentId)?.creditsMicro ?? 0;
		const antes = f.base.credits.getBalance(userId).totalMicro;

		const preview = f.payments.refundPreview({ paymentId, amountEurCents: 500 });

		expect(preview.creditsToWithdrawMicro).toBe(Math.floor((creditsMicro * 500) / 1000));
		expect(preview.refundableEurCents).toBe(1000);
		expect(paymentOf(paymentId)).toMatchObject({ status: 'completed', refundedEurCents: 0 });
		expect(f.base.credits.getBalance(userId).totalMicro).toBe(antes);
	});

	it('descuenta lo ya reembolsado de lo reembolsable', () => {
		const { userId } = f.addAccount('usr_vista_previa_parcial');
		const adminId = f.addAccount('adm_vista_previa', 'admin').userId;
		const paymentId = buy(userId, 'att_vista_previa_parcial');
		f.payments.refund({ adminId, paymentId, amountEurCents: 300, reason: 'Parte' });

		const preview = f.payments.refundPreview({ paymentId, amountEurCents: 100 });

		expect(preview.refundableEurCents).toBe(700);
	});
});
