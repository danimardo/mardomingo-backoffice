// Anulación del saldo al borrar la cuenta (BE-FR-07 CA4; D-15). Regla pura: sin base de datos ni reloj.
import { describe, expect, it } from 'vitest';
import { balanceOf, debtFromLines, reconstruct, type Bucket, type LedgerState } from './ledger';
import { applyForfeit } from './forfeit';

function bucket(overrides: Partial<Bucket> & Pick<Bucket, 'id'>): Bucket {
	return {
		kind: 'paid',
		source: 'purchase',
		initial: 1_000,
		remaining: 1_000,
		expiresAt: null,
		createdAt: 1,
		...overrides
	};
}

describe('applyForfeit', () => {
	it('pone a cero cada bolsa con saldo con un movimiento forfeit negativo ligado a ella', () => {
		const state: LedgerState = {
			buckets: [
				bucket({ id: 'b1', kind: 'free', source: 'welcome', remaining: 400 }),
				bucket({ id: 'b2', remaining: 250 })
			],
			debt: 0
		};

		const result = applyForfeit(state);

		expect(result.lines).toEqual([
			{ type: 'forfeit', amount: -400, bucketId: 'b1' },
			{ type: 'forfeit', amount: -250, bucketId: 'b2' }
		]);
		expect(result.state.buckets.map((item) => item.remaining)).toEqual([0, 0]);
	});

	it('no genera movimientos para las bolsas ya vacías', () => {
		const state: LedgerState = {
			buckets: [bucket({ id: 'b1', remaining: 0 }), bucket({ id: 'b2', remaining: 90 })],
			debt: 0
		};

		expect(applyForfeit(state).lines).toEqual([{ type: 'forfeit', amount: -90, bucketId: 'b2' }]);
	});

	it('una cuenta sin saldo no genera ningún movimiento y el estado no cambia', () => {
		const state: LedgerState = { buckets: [bucket({ id: 'b1', remaining: 0 })], debt: 0 };

		const result = applyForfeit(state);

		expect(result.lines).toEqual([]);
		expect(result.state).toEqual(state);
	});

	it('la deuda no se anula: el borrado no perdona lo que se debe', () => {
		const state: LedgerState = { buckets: [bucket({ id: 'b1', remaining: 300 })], debt: 120 };

		const result = applyForfeit(state);

		expect(result.state.debt).toBe(120);
		expect(balanceOf(result.state)).toBe(-120);
		expect(result.lines.every((line) => line.bucketId !== null)).toBe(true);
	});

	it('conserva el invariante del libro: el saldo reconstruido baja exactamente lo anulado', () => {
		const state: LedgerState = {
			buckets: [bucket({ id: 'b1', remaining: 700 }), bucket({ id: 'b2', remaining: 50 })],
			debt: 0
		};
		const result = applyForfeit(state);

		expect(reconstruct(result.lines)).toBe(balanceOf(result.state) - balanceOf(state));
		expect(debtFromLines(result.lines)).toBe(0);
	});
});
