// Reglas de compra del ledger: bolsa de compra con su pago, retirada por reembolso y contracargo (BE-FR-24, BE-FR-27,
// BE-FR-28, H-12; T232). Puras: sin base de datos.
import { describe, expect, it } from 'vitest';
import {
	applyChargeback,
	applyCredit,
	applyRefundWithdrawal,
	type Bucket,
	type LedgerState
} from './ledger';

const CREDIT = 1_000_000;
const NOW = 1_800_000_000_000;

function purchaseBucket(overrides: Partial<Bucket> = {}): Bucket {
	return {
		id: 'bkt_compra',
		kind: 'paid',
		source: 'purchase',
		initial: 10_500 * CREDIT,
		remaining: 8500 * CREDIT,
		expiresAt: null,
		createdAt: NOW,
		paymentId: 'pay_1',
		simulated: false,
		...overrides
	};
}

const stateWith = (buckets: Bucket[], debt = 0): LedgerState => ({ buckets, debt });

describe('applyCredit con compra', () => {
	it('guarda el pago y la marca de simulada en la bolsa', () => {
		const result = applyCredit(stateWith([]), {
			id: 'bkt_1',
			kind: 'paid',
			source: 'purchase',
			amount: 10_500 * CREDIT,
			expiresAt: null,
			createdAt: NOW,
			type: 'purchase',
			paymentId: 'pay_1',
			simulated: true
		});

		expect(result.state.buckets[0]).toMatchObject({ paymentId: 'pay_1', simulated: true });
	});

	it('sin pago ni marca, la bolsa queda sin compra y no simulada', () => {
		const result = applyCredit(stateWith([]), {
			id: 'bkt_2',
			kind: 'paid',
			source: 'adjustment',
			amount: CREDIT,
			expiresAt: null,
			createdAt: NOW,
			type: 'adjustment'
		});

		expect(result.state.buckets[0]).toMatchObject({ paymentId: null, simulated: false });
	});
});

describe('applyRefundWithdrawal (BE-FR-27)', () => {
	it('retira de la bolsa de la compra con un movimiento refund negativo', () => {
		const result = applyRefundWithdrawal(stateWith([purchaseBucket()]), {
			bucketId: 'bkt_compra',
			amount: 2000 * CREDIT
		});

		expect(result).toMatchObject({
			ok: true,
			state: { buckets: [{ remaining: 6500 * CREDIT }], debt: 0 },
			lines: [{ type: 'refund', amount: -2000 * CREDIT, bucketId: 'bkt_compra' }]
		});
	});

	it('rechaza una cantidad no positiva', () => {
		expect(
			applyRefundWithdrawal(stateWith([purchaseBucket()]), { bucketId: 'bkt_compra', amount: 0 })
		).toEqual({ ok: false, reason: 'amount_not_positive' });
	});

	it('rechaza retirar más que el saldo de la bolsa, o una bolsa que no existe', () => {
		expect(
			applyRefundWithdrawal(stateWith([purchaseBucket()]), {
				bucketId: 'bkt_compra',
				amount: 8501 * CREDIT
			})
		).toEqual({ ok: false, reason: 'exceeds_bucket' });
		expect(
			applyRefundWithdrawal(stateWith([]), { bucketId: 'bkt_compra', amount: CREDIT })
		).toEqual({ ok: false, reason: 'exceeds_bucket' });
	});
});

describe('applyChargeback (H-12)', () => {
	it('retira lo que quede de la bolsa y pasa el resto a deuda, sin tope', () => {
		const result = applyChargeback(stateWith([purchaseBucket({ remaining: 500 * CREDIT })]), {
			bucketId: 'bkt_compra',
			targetMicro: 8500 * CREDIT
		});

		expect(result.withdrawnMicro).toBe(500 * CREDIT);
		expect(result.debtAddedMicro).toBe(8000 * CREDIT);
		expect(result.state.debt).toBe(8000 * CREDIT);
		expect(result.lines).toEqual([
			{ type: 'chargeback', amount: -500 * CREDIT, bucketId: 'bkt_compra' },
			{ type: 'chargeback', amount: -8000 * CREDIT, bucketId: null }
		]);
	});

	it('si la bolsa cubre todo el objetivo, no genera deuda', () => {
		const result = applyChargeback(stateWith([purchaseBucket()]), {
			bucketId: 'bkt_compra',
			targetMicro: 1000 * CREDIT
		});

		expect(result.debtAddedMicro).toBe(0);
		expect(result.lines).toEqual([
			{ type: 'chargeback', amount: -1000 * CREDIT, bucketId: 'bkt_compra' }
		]);
	});

	it('si la bolsa ya no tiene saldo ni aparece en el estado, todo pasa a deuda', () => {
		const result = applyChargeback(stateWith([]), {
			bucketId: 'bkt_compra',
			targetMicro: 300 * CREDIT
		});

		expect(result.withdrawnMicro).toBe(0);
		expect(result.state.debt).toBe(300 * CREDIT);
		expect(result.lines).toEqual([{ type: 'chargeback', amount: -300 * CREDIT, bucketId: null }]);
	});
});
