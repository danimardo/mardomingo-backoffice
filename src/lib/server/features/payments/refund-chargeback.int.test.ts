// Reembolsos y contracargos contra SQLite real (T235; BE-FR-27, BE-FR-28; D01, D02, R12): reembolso manual con motivo y auditoría,
// créditos a retirar indicados por el administrador, importe solo en compras reales, reenvíos del mismo formulario que no se
// aplican dos veces, rechazo cuando los créditos no caben en la bolsa, y contracargo que retira el saldo, pasa el resto a deuda
// sin tope, bloquea la cuenta y no se repite con un evento repetido.
import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
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
import { toEpochMs } from '$lib/shared/time';
import { payments, refundKeys } from './schema';

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

/** Compra de 10 € con la renuncia vigente de la propia cuenta. Es simulada: así la crea el proveedor de pruebas. */
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

/**
 * Trata la compra como real (proveedor `stripe`, no simulada). El doble no tiene proveedor real, así que se cambia la fila
 * de pago; la bolsa de créditos ya está acreditada y no cambia.
 */
function asRealPurchase(paymentId: string): void {
	f.base.db
		.update(payments)
		.set({ provider: 'stripe', simulated: false })
		.where(eq(payments.id, paymentId))
		.run();
}

/** Compra de 10 € tratada como real (10.500 créditos en su bolsa). */
function buyReal(userId: string, attemptId: string): string {
	const paymentId = buy(userId, attemptId);
	asRealPurchase(paymentId);
	return paymentId;
}

function paymentOf(paymentId: string) {
	return f.base.db.select().from(payments).where(eq(payments.id, paymentId)).get();
}

function refundMovements() {
	return f.base.db.select().from(creditMovements).where(eq(creditMovements.type, 'refund')).all();
}

describe('reembolso manual de compra real (BE-FR-27, D01)', () => {
	it('reembolso total: movimiento refund con los créditos indicados, importe, estado, auditoría y evento', () => {
		const { userId } = f.addAccount('usr_reembolso');
		const adminId = f.addAccount('adm_reembolso', 'admin').userId;
		const paymentId = buyReal(userId, 'att_reembolso');

		const outcome = f.payments.refund({
			adminId,
			paymentId,
			amountEurCents: 1000,
			creditsToRemoveMicro: 10_500 * CREDIT,
			reason: 'El cliente lo pidió en plazo',
			idempotencyKey: randomUUID()
		});

		expect(outcome).toEqual({ status: 'refunded', refundedEurCents: 1000 });
		expect(paymentOf(paymentId)).toMatchObject({ status: 'refunded', refundedEurCents: 1000 });
		expect(refundMovements()).toEqual([
			expect.objectContaining({ amountMicro: -10_500 * CREDIT, paymentId, adminId })
		]);
		expect(f.base.credits.getBalance(userId).totalMicro).toBe(0);
		expect(f.base.db.select().from(adminAudit).all()).toEqual([
			expect.objectContaining({ adminId, action: 'payments.refund', entityId: paymentId })
		]);
		expect(eventsNamed(f.base.logger, 'payments.refund.applied')).toHaveLength(1);
	});

	// R12 (propuesta de reglas, sin número de decisión): un reenvío del mismo formulario de reembolso parcial no debe aplicarse
	// otra vez. Antes de la clave, este mismo caso devolvía 1.000 de 1.000 y retiraba los créditos dos veces.
	it('un reenvío con la misma clave no reembolsa ni retira créditos otra vez', () => {
		const { userId } = f.addAccount('usr_reenvio');
		const adminId = f.addAccount('adm_reenvio', 'admin').userId;
		const paymentId = buyReal(userId, 'att_reenvio');
		const form = {
			adminId,
			paymentId,
			amountEurCents: 500,
			creditsToRemoveMicro: 5_250 * CREDIT,
			reason: 'Parte del pack',
			idempotencyKey: randomUUID()
		};

		const primero = f.payments.refund(form);
		const reenvio = f.payments.refund(form);

		expect(primero).toEqual({ status: 'partially_refunded', refundedEurCents: 500 });
		expect(reenvio).toEqual({ status: 'partially_refunded', refundedEurCents: 500 });
		expect(paymentOf(paymentId)).toMatchObject({
			status: 'partially_refunded',
			refundedEurCents: 500
		});
		expect(f.base.credits.getBalance(userId).totalMicro).toBe(5_250 * CREDIT);
		expect(refundMovements()).toHaveLength(1);
		expect(f.base.db.select().from(adminAudit).all()).toHaveLength(1);
		expect(eventsNamed(f.base.logger, 'payments.refund.repeated')).toHaveLength(1);
	});

	// R12 (atomicidad): si el cambio de estado falla después de retirar los créditos, la retirada se deshace con él. El fallo
	// simulado es un trigger de SQLite sobre `payments.status` creado tras la compra; se quita antes del reenvío.
	it('si el cambio de estado falla a mitad, la retirada de créditos también se deshace y la clave se libera', () => {
		const { userId } = f.addAccount('usr_atomico');
		const adminId = f.addAccount('adm_atomico', 'admin').userId;
		const paymentId = buyReal(userId, 'att_atomico');
		const form = {
			adminId,
			paymentId,
			amountEurCents: 1000,
			creditsToRemoveMicro: 10_500 * CREDIT,
			reason: 'Fallo a mitad',
			idempotencyKey: randomUUID()
		};
		f.base.db.run(
			sql`CREATE TRIGGER fallo_estado_reembolso BEFORE UPDATE OF status ON payments WHEN NEW.status IN ('refunded', 'partially_refunded') BEGIN SELECT RAISE(ABORT, 'fallo simulado'); END`
		);

		expect(() => f.payments.refund(form)).toThrow();

		expect(f.base.credits.getBalance(userId).totalMicro).toBe(10_500 * CREDIT);
		expect(refundMovements()).toHaveLength(0);
		expect(paymentOf(paymentId)).toMatchObject({ status: 'completed', refundedEurCents: 0 });
		expect(f.base.db.select().from(adminAudit).all()).toHaveLength(0);

		f.base.db.run(sql`DROP TRIGGER fallo_estado_reembolso`);
		expect(f.payments.refund(form)).toEqual({ status: 'refunded', refundedEurCents: 1000 });
		expect(f.base.credits.getBalance(userId).totalMicro).toBe(0);
		expect(refundMovements()).toHaveLength(1);
	});

	it('dos formularios distintos sí son dos reembolsos parciales', () => {
		const { userId } = f.addAccount('usr_dos_parciales');
		const adminId = f.addAccount('adm_dos_parciales', 'admin').userId;
		const paymentId = buyReal(userId, 'att_dos_parciales');

		f.payments.refund({
			adminId,
			paymentId,
			amountEurCents: 300,
			creditsToRemoveMicro: 3_000 * CREDIT,
			reason: 'Primera parte',
			idempotencyKey: randomUUID()
		});
		const segundo = f.payments.refund({
			adminId,
			paymentId,
			amountEurCents: 200,
			creditsToRemoveMicro: 2_000 * CREDIT,
			reason: 'Segunda parte',
			idempotencyKey: randomUUID()
		});

		expect(segundo).toEqual({ status: 'partially_refunded', refundedEurCents: 500 });
		expect(f.base.credits.getBalance(userId).totalMicro).toBe(5_500 * CREDIT);
	});

	it('reembolso parcial sin créditos a retirar: se devuelve dinero y el saldo no cambia', () => {
		const { userId } = f.addAccount('usr_solo_dinero');
		const adminId = f.addAccount('adm_solo_dinero', 'admin').userId;
		const paymentId = buyReal(userId, 'att_solo_dinero');

		const outcome = f.payments.refund({
			adminId,
			paymentId,
			amountEurCents: 500,
			creditsToRemoveMicro: 0,
			reason: 'Ajuste comercial',
			idempotencyKey: randomUUID()
		});

		expect(outcome).toEqual({ status: 'partially_refunded', refundedEurCents: 500 });
		expect(f.base.credits.getBalance(userId).totalMicro).toBe(10_500 * CREDIT);
		expect(refundMovements()).toHaveLength(0);
	});

	it('créditos a retirar por encima de los no consumidos: PAYMENT_NOT_REFUNDABLE, nada cambia y la clave se libera', () => {
		const { userId } = f.addAccount('usr_consumido');
		const adminId = f.addAccount('adm_consumido', 'admin').userId;
		const paymentId = buyReal(userId, 'att_consumido');
		markRealPurchase(f.base.db, userId);
		const reserved = f.base.credits.reserve({
			userId,
			appId: SEEDED_APP_ID,
			operationId: insertInFlightOperation(f.base.db, { userId }),
			amountMicro: 10_000 * CREDIT
		});
		if (!reserved.ok) throw new Error('la reserva debía caber');
		f.base.credits.chargeAndRelease({ holdId: reserved.holdId, realCostMicro: 10_000 * CREDIT });
		const idempotencyKey = randomUUID();
		const form = {
			adminId,
			paymentId,
			amountEurCents: 1000,
			creditsToRemoveMicro: 10_500 * CREDIT,
			reason: 'Ya consumido',
			idempotencyKey
		};

		const error = errorOf(() => f.payments.refund(form));

		expect(error).toMatchObject({ code: 'PAYMENT_NOT_REFUNDABLE' });
		expect(paymentOf(paymentId)).toMatchObject({ status: 'completed', refundedEurCents: 0 });
		expect(f.base.credits.getBalance(userId).totalMicro).toBe(500 * CREDIT);
		expect(eventsNamed(f.base.logger, 'payments.refund.rejected')).toHaveLength(1);
		expect(f.base.db.select().from(refundKeys).all()).toHaveLength(0);

		// La misma clave, corregidos los créditos, sí aplica: el rechazo no dejó la clave ocupada.
		f.payments.refund({ ...form, creditsToRemoveMicro: 500 * CREDIT });
		expect(paymentOf(paymentId)).toMatchObject({ status: 'refunded', refundedEurCents: 1000 });
		expect(f.base.credits.getBalance(userId).totalMicro).toBe(0);
	});

	it('el saldo de la bolsa es el límite exacto: retirar lo que queda sí, un micro-crédito más no', () => {
		const { userId } = f.addAccount('usr_limite_bolsa');
		const adminId = f.addAccount('adm_limite_bolsa', 'admin').userId;
		const paymentId = buyReal(userId, 'att_limite_bolsa');
		const base = { adminId, paymentId, amountEurCents: 1000, reason: 'Límite' };

		expect(
			errorOf(() =>
				f.payments.refund({
					...base,
					creditsToRemoveMicro: 10_500 * CREDIT + 1,
					idempotencyKey: randomUUID()
				})
			)
		).toMatchObject({ code: 'PAYMENT_NOT_REFUNDABLE' });
		expect(paymentOf(paymentId)).toMatchObject({ status: 'completed' });

		expect(
			f.payments.refund({
				...base,
				creditsToRemoveMicro: 10_500 * CREDIT,
				idempotencyKey: randomUUID()
			})
		).toEqual({ status: 'refunded', refundedEurCents: 1000 });
		expect(f.base.credits.getBalance(userId).totalMicro).toBe(0);
	});

	it('el importe puede llegar hasta lo pagado y no más: un céntimo de más se rechaza', () => {
		const { userId } = f.addAccount('usr_importe_frontera');
		const adminId = f.addAccount('adm_importe_frontera', 'admin').userId;
		const paymentId = buyReal(userId, 'att_importe_frontera');
		const base = { adminId, paymentId, creditsToRemoveMicro: 0, reason: 'Frontera' };

		expect(
			errorOf(() =>
				f.payments.refund({ ...base, amountEurCents: 1001, idempotencyKey: randomUUID() })
			)
		).toMatchObject({ code: 'PAYMENT_NOT_REFUNDABLE' });
		expect(
			f.payments.refund({ ...base, amountEurCents: 1000, idempotencyKey: randomUUID() })
		).toEqual({ status: 'refunded', refundedEurCents: 1000 });
		expect(
			errorOf(() => f.payments.refund({ ...base, amountEurCents: 1, idempotencyKey: randomUUID() }))
		).toMatchObject({ code: 'PAYMENT_NOT_REFUNDABLE' });
	});

	it('una clave de un reembolso en curso bloquea cualquier otro reembolso de la misma compra', () => {
		const { userId } = f.addAccount('usr_en_curso');
		const adminId = f.addAccount('adm_en_curso', 'admin').userId;
		const paymentId = buyReal(userId, 'att_en_curso');
		f.base.db
			.insert(refundKeys)
			.values({
				key: 'clave_en_curso_0001',
				paymentId,
				status: 'claimed',
				createdAt: toEpochMs(f.base.clock.now())
			})
			.run();
		const base = {
			adminId,
			paymentId,
			amountEurCents: 500,
			creditsToRemoveMicro: 5_250 * CREDIT,
			reason: 'En curso'
		};

		expect(
			errorOf(() => f.payments.refund({ ...base, idempotencyKey: randomUUID() }))
		).toMatchObject({ code: 'PAYMENT_NOT_REFUNDABLE' });
		expect(
			errorOf(() => f.payments.refund({ ...base, idempotencyKey: 'clave_en_curso_0001' }))
		).toMatchObject({ code: 'PAYMENT_NOT_REFUNDABLE' });
		expect(paymentOf(paymentId)).toMatchObject({ status: 'completed', refundedEurCents: 0 });
		expect(f.base.credits.getBalance(userId).totalMicro).toBe(10_500 * CREDIT);
	});

	it('una clave usada en otra compra se rechaza sin tocar ninguna de las dos', () => {
		const { userId } = f.addAccount('usr_clave_ajena');
		const adminId = f.addAccount('adm_clave_ajena', 'admin').userId;
		const primera = buyReal(userId, 'att_clave_ajena_1');
		const segunda = buy(userId, 'att_clave_ajena_2');
		const idempotencyKey = randomUUID();
		f.payments.refund({
			adminId,
			paymentId: primera,
			amountEurCents: 500,
			creditsToRemoveMicro: 0,
			reason: 'Primera',
			idempotencyKey
		});

		expect(
			errorOf(() =>
				f.payments.refund({
					adminId,
					paymentId: segunda,
					amountEurCents: 0,
					creditsToRemoveMicro: 1,
					reason: 'Segunda',
					idempotencyKey
				})
			)
		).toMatchObject({ code: 'VALIDATION_ERROR', details: { field: 'idempotencyKey' } });
		expect(paymentOf(segunda)).toMatchObject({ status: 'completed', refundedEurCents: 0 });
	});

	it('el motivo es obligatorio', () => {
		const { userId } = f.addAccount('usr_sin_motivo');
		const adminId = f.addAccount('adm_sin_motivo', 'admin').userId;
		const paymentId = buyReal(userId, 'att_sin_motivo');

		expect(
			errorOf(() =>
				f.payments.refund({
					adminId,
					paymentId,
					amountEurCents: 1000,
					creditsToRemoveMicro: 10_500 * CREDIT,
					reason: '   ',
					idempotencyKey: randomUUID()
				})
			)
		).toMatchObject({ code: 'VALIDATION_ERROR' });
		expect(paymentOf(paymentId)).toMatchObject({ status: 'completed' });
	});

	it('créditos negativos y un importe en una compra real sin importe se rechazan', () => {
		const { userId } = f.addAccount('usr_negativos');
		const adminId = f.addAccount('adm_negativos', 'admin').userId;
		const paymentId = buyReal(userId, 'att_negativos');
		const base = { adminId, paymentId, reason: 'Negativos' };

		expect(
			errorOf(() =>
				f.payments.refund({
					...base,
					amountEurCents: 100,
					creditsToRemoveMicro: -1,
					idempotencyKey: randomUUID()
				})
			)
		).toMatchObject({ code: 'VALIDATION_ERROR', details: { field: 'credits' } });
		expect(
			errorOf(() =>
				f.payments.refund({
					...base,
					amountEurCents: 0,
					creditsToRemoveMicro: 1,
					idempotencyKey: randomUUID()
				})
			)
		).toMatchObject({ code: 'VALIDATION_ERROR', details: { field: 'amount' } });
		expect(paymentOf(paymentId)).toMatchObject({ status: 'completed', refundedEurCents: 0 });
	});
});

describe('reembolso de compra simulada (D02)', () => {
	it('solo retira créditos: la compra queda refunded sin importe y no se reembolsa dos veces', () => {
		const { userId } = f.addAccount('usr_simulada');
		const adminId = f.addAccount('adm_simulada', 'admin').userId;
		const paymentId = buy(userId, 'att_simulada');

		const outcome = f.payments.refund({
			adminId,
			paymentId,
			amountEurCents: 0,
			creditsToRemoveMicro: 10_500 * CREDIT,
			reason: 'Prueba de tester',
			idempotencyKey: randomUUID()
		});

		expect(outcome).toEqual({ status: 'refunded', refundedEurCents: 0 });
		expect(paymentOf(paymentId)).toMatchObject({ status: 'refunded', refundedEurCents: 0 });
		expect(refundMovements()).toEqual([expect.objectContaining({ amountMicro: -10_500 * CREDIT })]);
		expect(
			errorOf(() =>
				f.payments.refund({
					adminId,
					paymentId,
					amountEurCents: 0,
					creditsToRemoveMicro: 0,
					reason: 'Otra vez',
					idempotencyKey: randomUUID()
				})
			)
		).toMatchObject({ code: 'PAYMENT_NOT_REFUNDABLE' });
		expect(refundMovements()).toHaveLength(1);
	});

	it('no admite importe en euros aunque se envíe', () => {
		const { userId } = f.addAccount('usr_simulada_importe');
		const adminId = f.addAccount('adm_simulada_importe', 'admin').userId;
		const paymentId = buy(userId, 'att_simulada_importe');

		expect(
			errorOf(() =>
				f.payments.refund({
					adminId,
					paymentId,
					amountEurCents: 1,
					creditsToRemoveMicro: 10_500 * CREDIT,
					reason: 'Con importe',
					idempotencyKey: randomUUID()
				})
			)
		).toMatchObject({ code: 'VALIDATION_ERROR', details: { field: 'amount' } });
		expect(paymentOf(paymentId)).toMatchObject({ status: 'completed' });
		expect(refundMovements()).toHaveLength(0);
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

describe('vista previa del reembolso (T308, D01)', () => {
	it('devuelve el plan con los importes indicados, sin escribir nada', () => {
		const { userId } = f.addAccount('usr_vista_previa');
		const paymentId = buyReal(userId, 'att_vista_previa');
		const antes = f.base.credits.getBalance(userId).totalMicro;

		const preview = f.payments.refundPreview({
			paymentId,
			amountEurCents: 500,
			creditsToRemoveMicro: 5_250 * CREDIT
		});

		expect(preview).toEqual({
			plan: { ok: true, newRefundedEurCents: 500, newStatus: 'partially_refunded' },
			refundableEurCents: 1000,
			simulated: false
		});
		expect(paymentOf(paymentId)).toMatchObject({ status: 'completed', refundedEurCents: 0 });
		expect(f.base.credits.getBalance(userId).totalMicro).toBe(antes);
	});

	it('descuenta lo ya reembolsado de lo reembolsable: exacto sí, un céntimo más no', () => {
		const { userId } = f.addAccount('usr_vista_previa_parcial');
		const adminId = f.addAccount('adm_vista_previa', 'admin').userId;
		const paymentId = buyReal(userId, 'att_vista_previa_parcial');
		f.payments.refund({
			adminId,
			paymentId,
			amountEurCents: 300,
			creditsToRemoveMicro: 0,
			reason: 'Parte',
			idempotencyKey: randomUUID()
		});

		const exacta = f.payments.refundPreview({
			paymentId,
			amountEurCents: 700,
			creditsToRemoveMicro: 0
		});
		const excedida = f.payments.refundPreview({
			paymentId,
			amountEurCents: 701,
			creditsToRemoveMicro: 0
		});

		expect(exacta.refundableEurCents).toBe(700);
		expect(exacta.plan).toEqual({ ok: true, newRefundedEurCents: 1000, newStatus: 'refunded' });
		expect(excedida.plan).toEqual({ ok: false, reason: 'amount_exceeds_paid' });
	});

	it('en una compra simulada, la vista previa rechaza el importe y acepta solo créditos', () => {
		const { userId } = f.addAccount('usr_vista_simulada');
		const paymentId = buy(userId, 'att_vista_simulada');

		expect(
			f.payments.refundPreview({ paymentId, amountEurCents: 1, creditsToRemoveMicro: 1 }).plan
		).toEqual({ ok: false, reason: 'amount_not_allowed' });
		expect(
			f.payments.refundPreview({ paymentId, amountEurCents: 0, creditsToRemoveMicro: 1 }).plan
		).toEqual({ ok: true, newRefundedEurCents: 0, newStatus: 'refunded' });
	});
});
