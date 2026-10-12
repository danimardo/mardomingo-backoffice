// Compras contra SQLite real (T234; BE-FR-23, BE-FR-24/CA1, BE-FR-25 CA1–CA5, BE-FR-26): compra simulada con su bolsa y su
// IVA, idempotencia por intento y por evento de webhook, disponibilidad en producción simulada, paquetes inactivos,
// fallos del proveedor y renuncia propia.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditBuckets, userBalances } from '$lib/server/features/credits/schema';
import { invoices } from '$lib/server/features/invoicing/schema';
import { packs, payments } from './schema';
import { paymentsFixture, type PaymentsFixture } from '../../../../../tests/builders/payments';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';

const CREDIT = 1_000_000;
const PACK_10 = 'pck_seed_10eur';

let f: PaymentsFixture;

beforeEach(() => {
	f = paymentsFixture('test');
});

afterEach(() => {
	f.close();
});

/** Ejecuta la operación y devuelve el error que lanza; falla si no lanza nada. */
function errorOf(run: () => unknown): unknown {
	try {
		run();
	} catch (error) {
		return error;
	}
	throw new Error('se esperaba un error y no se lanzó ninguno');
}

function paymentRowsOf(userId: string) {
	return f.base.db.select().from(payments).where(eq(payments.userId, userId)).all();
}

function purchase(userId: string, waiverId: string, attemptId = 'att_1', packId = PACK_10) {
	return f.payments.purchase({
		userId,
		role: 'user',
		attemptId,
		packId,
		wantsFullInvoice: false,
		withdrawalAcceptanceId: waiverId
	});
}

describe('compra simulada (BE-FR-25 CA1, CA3, CA5)', () => {
	it('10 € dan una bolsa de 10.500 créditos y el saldo nuevo', () => {
		const { userId, waiverId } = f.addAccount('usr_compra');

		const outcome = purchase(userId, waiverId);

		expect(outcome).toMatchObject({ status: 'completed', creditsMicro: 10_500 * CREDIT });
		expect(f.base.credits.getBalance(userId).totalMicro).toBe(10_500 * CREDIT);
		const buckets = f.base.db
			.select()
			.from(creditBuckets)
			.where(eq(creditBuckets.userId, userId))
			.all();
		expect(buckets).toEqual([
			expect.objectContaining({ kind: 'paid', source: 'purchase', simulated: true })
		]);
	});

	it('guarda el IVA del 21 % incluido y el país', () => {
		const { userId, waiverId } = f.addAccount('usr_iva');

		purchase(userId, waiverId);

		expect(paymentRowsOf(userId)).toEqual([
			expect.objectContaining({
				status: 'completed',
				amountEurCents: 1000,
				baseEurCents: 826,
				vatEurCents: 174,
				vatRatePpm: 210_000,
				country: 'ES',
				simulated: true
			})
		]);
	});

	it('la simulada no marca la compra real ni genera factura', () => {
		const { userId, waiverId } = f.addAccount('usr_sin_real');

		purchase(userId, waiverId);

		const balance = f.base.db
			.select()
			.from(userBalances)
			.where(eq(userBalances.userId, userId))
			.get();
		expect(balance?.hasRealPurchase ?? false).toBe(false);
		expect(f.base.db.select().from(invoices).all()).toEqual([]);
	});
});

describe('idempotencia (BE-FR-25 CA4, BE-FR-24 CA1)', () => {
	it('repetir el mismo intento devuelve la compra existente sin acreditar otra vez', () => {
		const { userId, waiverId } = f.addAccount('usr_doble');
		const first = purchase(userId, waiverId, 'att_doble');

		const second = purchase(userId, waiverId, 'att_doble');

		expect(first.status).toBe('completed');
		expect(second.status).toBe('repeated');
		expect(f.base.credits.getBalance(userId).totalMicro).toBe(10_500 * CREDIT);
		expect(paymentRowsOf(userId)).toHaveLength(1);
		expect(eventsNamed(f.base.logger, 'payments.purchase.duplicate')).toHaveLength(1);
	});

	it('un evento de webhook entregado dos veces acredita una sola vez', () => {
		const { userId, waiverId } = f.addAccount('usr_webhook');
		const outcome = purchase(userId, waiverId, 'att_webhook');
		if (outcome.status !== 'completed') throw new Error('la compra debía completarse');
		const providerRef = `fake_${outcome.paymentId}`;
		// Simulamos un pago que el proveedor confirma por webhook después de haberlo completado: debe ignorarse.
		f.provider.repeatWebhooks();

		f.payments.handleProviderEvents({ type: 'payment_completed', providerRef });

		expect(f.base.credits.getBalance(userId).totalMicro).toBe(10_500 * CREDIT);
		expect(eventsNamed(f.base.logger, 'payments.webhook.duplicate').length).toBeGreaterThan(0);
	});
});

describe('producción simulada (BE-FR-25 CA2)', () => {
	it('en producción, un usuario normal no puede comprar en simulado', () => {
		const prod = paymentsFixture('production');
		try {
			const { userId, waiverId } = prod.addAccount('usr_prod');

			expect(
				errorOf(() =>
					prod.payments.purchase({
						userId,
						role: 'user',
						attemptId: 'att_prod',
						packId: PACK_10,
						wantsFullInvoice: false,
						withdrawalAcceptanceId: waiverId
					})
				)
			).toMatchObject({ code: 'PURCHASE_NOT_AVAILABLE' });
		} finally {
			prod.close();
		}
	});

	it('en producción, testers y administradores sí compran en simulado', () => {
		const prod = paymentsFixture('production');
		try {
			for (const role of ['tester', 'admin']) {
				const { userId, waiverId } = prod.addAccount(`usr_${role}`, role);
				const outcome = prod.payments.purchase({
					userId,
					role,
					attemptId: `att_${role}`,
					packId: PACK_10,
					wantsFullInvoice: false,
					withdrawalAcceptanceId: waiverId
				});
				expect(outcome.status).toBe('completed');
			}
		} finally {
			prod.close();
		}
	});
});

describe('paquetes, proveedor y renuncia (BE-FR-23, BE-FR-26)', () => {
	it('un paquete inactivo no se vende', () => {
		const { userId, waiverId } = f.addAccount('usr_inactivo');
		f.base.db.update(packs).set({ active: false }).where(eq(packs.id, PACK_10)).run();

		expect(errorOf(() => purchase(userId, waiverId, 'att_inactivo'))).toMatchObject({
			code: 'PACK_INACTIVE'
		});
		expect(paymentRowsOf(userId)).toEqual([]);
	});

	it('si el proveedor falla, no se cobra, no se crea la compra y se registra el fallo', () => {
		const { userId, waiverId } = f.addAccount('usr_fallo');
		f.provider.failNextCheckout();

		expect(errorOf(() => purchase(userId, waiverId, 'att_fallo'))).toMatchObject({
			code: 'PAYMENT_PROVIDER_ERROR'
		});
		expect(paymentRowsOf(userId)).toEqual([]);
		expect(f.base.credits.getBalance(userId).totalMicro).toBe(0);
		expect(eventsNamed(f.base.logger, 'payments.purchase.failed')).toHaveLength(1);
	});

	it('la renuncia debe ser de la propia cuenta', () => {
		const { userId } = f.addAccount('usr_renuncia');
		const otra = f.addAccount('usr_otra');

		expect(
			errorOf(() =>
				f.payments.purchase({
					userId,
					role: 'user',
					attemptId: 'att_renuncia',
					packId: PACK_10,
					wantsFullInvoice: false,
					withdrawalAcceptanceId: otra.waiverId
				})
			)
		).toMatchObject({ code: 'VALIDATION_ERROR' });
		expect(paymentRowsOf(userId)).toEqual([]);
	});
});
