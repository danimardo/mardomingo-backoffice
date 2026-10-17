// Compras de un periodo para la exportación contable (BE-FR-76; T316) contra SQLite real: incluye solo las compras dentro del periodo,
// con su día civil de Madrid, sin datos de otras cuentas y con las simuladas marcadas.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { paymentsFixture, type PaymentsFixture } from '../../../../../tests/builders/payments';
import { markRealPurchase } from '../../../../../tests/builders/purchases';
import { civilDateOf } from '$lib/shared/dates';
import { toEpochMs } from '$lib/shared/time';

let f: PaymentsFixture;

beforeEach(() => {
	f = paymentsFixture('test');
});

afterEach(() => {
	f.close();
});

describe('compras de un periodo (BE-FR-76)', () => {
	it('devuelve las compras del periodo con su día de Madrid y marca las simuladas', () => {
		const { userId, waiverId } = f.addAccount('usr_facturas');
		const bought = f.payments.purchase({
			userId,
			role: 'user',
			attemptId: 'att_contable',
			packId: 'pck_seed_10eur',
			wantsFullInvoice: false,
			withdrawalAcceptanceId: waiverId
		});
		expect(bought.status).toBe('completed');
		markRealPurchase(f.base.db, userId);

		const now = new Date(f.base.clock.now());
		const from = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
		const to = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59);
		const facts = f.payments.paymentFactsBetween({ fromMs: from, toMs: to });

		expect(facts).toHaveLength(1);
		expect(facts[0]).toMatchObject({
			paymentId: bought.paymentId,
			userId,
			date: civilDateOf(toEpochMs(f.base.clock.now())),
			country: 'ES',
			simulated: true,
			refundedEurCents: 0,
			chargebackEurCents: 0
		});
		const [fact] = facts;
		expect(fact?.totalEurCents).toBe((fact?.baseEurCents ?? 0) + (fact?.vatEurCents ?? 0));
	});

	it('una compra fuera del periodo no aparece', () => {
		const { userId, waiverId } = f.addAccount('usr_fuera');
		f.payments.purchase({
			userId,
			role: 'user',
			attemptId: 'att_fuera',
			packId: 'pck_seed_5eur',
			wantsFullInvoice: false,
			withdrawalAcceptanceId: waiverId
		});

		const facts = f.payments.paymentFactsBetween({
			fromMs: Date.UTC(2025, 0, 1),
			toMs: Date.UTC(2025, 0, 31)
		});

		expect(facts).toEqual([]);
	});
});
