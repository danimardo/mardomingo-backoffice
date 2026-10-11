// Propiedades del libro de créditos (data-model.md 5.1 D1–D7; Historias 15.8; SC-003; T118). Se generan secuencias de
// bienvenida, cobros, entradas, ajustes negativos y caducidades; tras cada paso se comprueban las invariantes. Semilla fija
// para que un fallo se reproduzca.
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
	applyCredit,
	applyExpiry,
	applyNegativeAdjustment,
	applyUsage,
	applyWelcome,
	balanceOf,
	debtFromLines,
	reconstruct,
	type Line,
	type LedgerState
} from './ledger';

const MAX_DEBT = 200_000_000;
const SEED = 20261011;

type Op =
	| { readonly kind: 'welcome'; readonly amount: number }
	| { readonly kind: 'usage'; readonly amount: number }
	| {
			readonly kind: 'credit';
			readonly paid: boolean;
			readonly amount: number;
	  }
	| { readonly kind: 'negative'; readonly paid: boolean; readonly amount: number }
	| { readonly kind: 'expiry'; readonly advance: number };

const opArb: fc.Arbitrary<Op> = fc.oneof(
	fc.record({
		kind: fc.constant('welcome' as const),
		amount: fc.integer({ min: 1, max: 2_000_000_000 })
	}),
	fc.record({
		kind: fc.constant('usage' as const),
		amount: fc.integer({ min: 1, max: 3_000_000_000 })
	}),
	fc.record({
		kind: fc.constant('credit' as const),
		paid: fc.boolean(),
		amount: fc.integer({ min: 1, max: 5_000_000_000 })
	}),
	fc.record({
		kind: fc.constant('negative' as const),
		paid: fc.boolean(),
		amount: fc.integer({ min: 1, max: 3_000_000_000 })
	}),
	fc.record({
		kind: fc.constant('expiry' as const),
		advance: fc.integer({ min: 0, max: 60 * 24 * 60 * 60 * 1000 })
	})
);

interface Run {
	state: LedgerState;
	lines: Line[];
	now: number;
	welcomed: boolean;
	seq: number;
}

function step(run: Run, op: Op): void {
	const id = `bkt_${String(run.seq)}`;
	run.seq += 1;
	switch (op.kind) {
		case 'welcome': {
			if (run.welcomed) return;
			const result = applyWelcome(run.state, {
				id,
				amount: op.amount,
				expiresAt: run.now + 30 * 86_400_000,
				createdAt: run.now
			});
			run.state = result.state;
			run.lines.push(...result.lines);
			run.welcomed = true;
			return;
		}
		case 'usage': {
			const result = applyUsage(run.state, { amount: op.amount, maxDebt: MAX_DEBT });
			run.state = result.state;
			run.lines.push(...result.lines);
			return;
		}
		case 'credit': {
			const result = applyCredit(run.state, {
				id,
				kind: op.paid ? 'paid' : 'free',
				source: 'adjustment',
				amount: op.amount,
				expiresAt: op.paid ? null : run.now + 30 * 86_400_000,
				createdAt: run.now,
				type: 'adjustment'
			});
			run.state = result.state;
			run.lines.push(...result.lines);
			return;
		}
		case 'negative': {
			const result = applyNegativeAdjustment(run.state, {
				kind: op.paid ? 'paid' : 'free',
				amount: op.amount,
				available: balanceOf(run.state)
			});
			if (result.ok) {
				run.state = result.state;
				run.lines.push(...result.lines);
			}
			return;
		}
		case 'expiry': {
			run.now += op.advance;
			const result = applyExpiry(run.state, run.now);
			run.state = result.state;
			run.lines.push(...result.lines);
			return;
		}
	}
}

/** Invariantes del libro tras cada paso (D1–D4 y el tope de deuda D7). */
function invariantsHold(run: Run): void {
	const { state, lines } = run;
	for (const item of state.buckets) {
		// D4: el saldo de una bolsa nunca es negativo ni supera lo que se le abonó.
		expect(item.remaining).toBeGreaterThanOrEqual(0);
		expect(item.remaining).toBeLessThanOrEqual(item.initial);
		// D1: el saldo de cada bolsa es la suma de sus líneas.
		const ofBucket = lines.filter((line) => line.bucketId === item.id);
		expect(item.remaining).toBe(reconstruct(ofBucket));
	}
	// D2: la deuda es −(suma de las líneas sin bolsa); D4 y D7: nunca negativa ni por encima de max_debt.
	expect(state.debt).toBe(debtFromLines(lines));
	expect(state.debt).toBeGreaterThanOrEqual(0);
	expect(state.debt).toBeLessThanOrEqual(MAX_DEBT);
	// D3: saldo materializado = reconstrucción desde el ledger.
	expect(balanceOf(state)).toBe(reconstruct(lines));
}

function freshRun(): Run {
	return {
		state: { buckets: [], debt: 0 },
		lines: [],
		now: 1_000_000_000_000,
		welcomed: false,
		seq: 0
	};
}

describe('propiedades del libro de créditos (D1–D7; semilla fija)', () => {
	it('[BE-FR-15/CA1] tras cualquier secuencia de bienvenida, cobros, entradas, ajustes y caducidades, las invariantes se mantienen', () => {
		fc.assert(
			fc.property(fc.array(opArb, { maxLength: 60 }), (ops) => {
				const run = freshRun();
				for (const op of ops) {
					step(run, op);
					invariantsHold(run);
				}
			}),
			{ seed: SEED, numRuns: 300 }
		);
	});

	it('la exposición de una cuenta nunca supera saldo + max_debt (BE-FR-71 CA1)', () => {
		fc.assert(
			fc.property(fc.array(opArb, { maxLength: 60 }), (ops) => {
				const run = freshRun();
				for (const op of ops) {
					step(run, op);
					// Lo que se debe nunca pasa del tope: la deuda acotada es la exposición que el libro acepta.
					expect(run.state.debt).toBeLessThanOrEqual(MAX_DEBT);
				}
			}),
			{ seed: SEED, numRuns: 200 }
		);
	});
});
