// Anulación del saldo al borrar la cuenta (BE-FR-07 CA4; D-15). Dominio puro: sin I/O ni reloj, como `ledger.ts`.
// Cada bolsa con saldo se pone a cero con un movimiento `forfeit` negativo ligado a ella. La deuda no se toca: el
// borrado de la cuenta no perdona lo que se debe.
import type { Line, LedgerState } from './ledger';

export function applyForfeit(state: LedgerState): {
	readonly state: LedgerState;
	readonly lines: readonly Line[];
} {
	const lines: Line[] = state.buckets
		.filter((item) => item.remaining > 0)
		.map((item) => ({ type: 'forfeit', amount: -item.remaining, bucketId: item.id }));
	if (lines.length === 0) return { state, lines };
	return {
		state: {
			buckets: state.buckets.map((item) => ({ ...item, remaining: 0 })),
			debt: state.debt
		},
		lines
	};
}
