// Pagos de una cuenta para su ficha de administración (W35; T306) contra SQLite real: solo los de esa cuenta, el más reciente primero,
// con su importe y la marca de simulado.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { paymentsFixture, type PaymentsFixture } from '../../../../../tests/builders/payments';
import { paymentsForAdmin } from './admin-payments';

let f: PaymentsFixture;

beforeEach(() => {
	f = paymentsFixture('test');
});

afterEach(() => {
	f.close();
});

describe('pagos de una cuenta para la ficha (T306)', () => {
	it('devuelve solo los pagos de esa cuenta, con su importe y su marca de simulado', () => {
		const { userId, waiverId } = f.addAccount('usr_ficha_pagos');
		const other = f.addAccount('usr_ficha_otra');
		const bought = f.payments.purchase({
			userId,
			role: 'user',
			attemptId: 'att_ficha_pago',
			packId: 'pck_seed_10eur',
			wantsFullInvoice: false,
			withdrawalAcceptanceId: waiverId
		});
		expect(bought.status).toBe('completed');
		f.payments.purchase({
			userId: other.userId,
			role: 'user',
			attemptId: 'att_ficha_otra',
			packId: 'pck_seed_10eur',
			wantsFullInvoice: false,
			withdrawalAcceptanceId: other.waiverId
		});

		const rows = paymentsForAdmin(f.base.db, userId, 20);

		expect(rows).toEqual([
			expect.objectContaining({
				id: bought.paymentId,
				status: 'completed',
				simulated: true,
				amountEurCents: 1000
			})
		]);
	});
});
