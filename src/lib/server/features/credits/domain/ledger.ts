// Dominio puro de créditos (BE-FR-12–18, BE-FR-71; data-model.md 5.1–5.2; T119). Sin I/O, sin `Date` y sin base de datos:
// el servicio carga el estado, aplica una transición de este módulo y persiste las líneas que devuelve. Así la misma regla
// la prueban las pruebas de reglas y las propiedades, y la usa la base de datos.
//
// Convención de signos: una línea con `bucketId` nulo afecta a la deuda (D2): −amount sube la deuda y +amount la baja.
// Los importes son micro-créditos (`Micro`, enteros).

export type BucketKind = 'free' | 'paid';
export type BucketSource = 'welcome' | 'purchase' | 'adjustment';
export type LineType =
	| 'welcome'
	| 'purchase'
	| 'usage'
	| 'adjustment'
	| 'expiry'
	| 'refund'
	| 'chargeback'
	| 'debt_settlement'
	| 'forfeit';

export interface Bucket {
	readonly id: string;
	readonly kind: BucketKind;
	readonly source: BucketSource;
	readonly initial: number;
	readonly remaining: number;
	readonly expiresAt: number | null;
	readonly createdAt: number;
}

export interface LedgerState {
	readonly buckets: readonly Bucket[];
	readonly debt: number;
}

/** Línea de movimiento que produce una transición (el servicio le añade referencias: operación, pago, admin…). */
export interface Line {
	readonly type: LineType;
	readonly amount: number;
	readonly bucketId: string | null;
}

export interface Take {
	readonly bucketId: string;
	readonly amount: number;
}

// ---------------------------------------------------------------------------------------------------------------------
// Bienvenida (BE-FR-12, BE-FR-11.5, D10)

export function canGrantWelcome(input: {
	readonly hashGranted: boolean;
	readonly accountHasWelcome: boolean;
}):
	| { readonly ok: true }
	| { readonly ok: false; readonly reason: 'hash_granted' | 'account_has_welcome' } {
	if (input.hashGranted) return { ok: false, reason: 'hash_granted' };
	if (input.accountHasWelcome) return { ok: false, reason: 'account_has_welcome' };
	return { ok: true };
}

/** Bolsa de bienvenida: `free`, con su importe, su caducidad y un único movimiento `welcome` (BE-FR-12). */
export function applyWelcome(
	state: LedgerState,
	input: {
		readonly id: string;
		readonly amount: number;
		readonly expiresAt: number;
		readonly createdAt: number;
	}
): { readonly state: LedgerState; readonly lines: readonly Line[] } {
	const created: Bucket = {
		id: input.id,
		kind: 'free',
		source: 'welcome',
		initial: input.amount,
		remaining: input.amount,
		expiresAt: input.expiresAt,
		createdAt: input.createdAt
	};
	return {
		state: { buckets: [...state.buckets, created], debt: state.debt },
		lines: [{ type: 'welcome', amount: input.amount, bucketId: input.id }]
	};
}

// ---------------------------------------------------------------------------------------------------------------------
// Orden de consumo (BE-FR-14)

/** Bolsas con saldo en el orden de consumo: free antes que paid; entre free, la que caduca antes; entre paid, la más antigua. */
export function consumptionOrder(buckets: readonly Bucket[]): readonly Bucket[] {
	return buckets
		.filter((item) => item.remaining > 0)
		.slice()
		.sort((left, right) => {
			if (left.kind !== right.kind) return left.kind === 'free' ? -1 : 1;
			const leftKey =
				left.kind === 'free' ? (left.expiresAt ?? Number.POSITIVE_INFINITY) : left.createdAt;
			const rightKey =
				right.kind === 'free' ? (right.expiresAt ?? Number.POSITIVE_INFINITY) : right.createdAt;
			if (leftKey !== rightKey) return leftKey - rightKey;
			return left.id.localeCompare(right.id);
		});
}

/** Reparte `amount` entre las bolsas en orden de consumo. `uncovered` es lo que no cubren. */
function takeFrom(
	ordered: readonly Bucket[],
	amount: number
): { readonly takes: readonly Take[]; readonly uncovered: number } {
	let left = amount;
	const takes: Take[] = [];
	for (const item of ordered) {
		if (left === 0) break;
		const taken = Math.min(item.remaining, left);
		takes.push({ bucketId: item.id, amount: taken });
		left -= taken;
	}
	return { takes, uncovered: left };
}

function withRemaining(buckets: readonly Bucket[], takes: readonly Take[]): readonly Bucket[] {
	return buckets.map((item) => {
		const taken = takes.find((take) => take.bucketId === item.id);
		return taken === undefined ? item : { ...item, remaining: item.remaining - taken.amount };
	});
}

// ---------------------------------------------------------------------------------------------------------------------
// Cobro y deuda (BE-FR-17, D2, D7, D8)

/**
 * Cobro del coste real (BE-FR-17): consume bolsas en orden; lo que no cubren pasa a deuda hasta `maxDebt`; el resto
 * lo absorbe el administrador (`absorbed`, sin movimiento, D8).
 */
export function applyUsage(
	state: LedgerState,
	input: { readonly amount: number; readonly maxDebt: number }
): {
	readonly state: LedgerState;
	readonly lines: readonly Line[];
	readonly takes: readonly Take[];
	readonly debtAdded: number;
	readonly absorbed: number;
} {
	const { takes, uncovered } = takeFrom(consumptionOrder(state.buckets), input.amount);
	const room = Math.max(0, input.maxDebt - state.debt);
	const debtAdded = Math.min(uncovered, room);
	const absorbed = uncovered - debtAdded;
	const lines: Line[] = takes.map((take) => ({
		type: 'usage',
		amount: -take.amount,
		bucketId: take.bucketId
	}));
	if (debtAdded > 0) lines.push({ type: 'usage', amount: -debtAdded, bucketId: null });
	return {
		state: { buckets: withRemaining(state.buckets, takes), debt: state.debt + debtAdded },
		lines,
		takes,
		debtAdded,
		absorbed
	};
}

/**
 * Entrada de crédito positiva (compra, o ajuste del administrador gratuito o comprado): crea su bolsa y liquida primero la
 * deuda como par que suma 0 (BE-FR-17, D13). En un ajuste gratuito, lo liquidado es pérdida informada (D14).
 */
export function applyCredit(
	state: LedgerState,
	input: {
		readonly id: string;
		readonly kind: BucketKind;
		readonly source: BucketSource;
		readonly amount: number;
		readonly expiresAt: number | null;
		readonly createdAt: number;
		readonly type: 'purchase' | 'adjustment';
	}
): {
	readonly state: LedgerState;
	readonly lines: readonly Line[];
	readonly absorbedLossMicro: number;
} {
	const settled = Math.min(input.amount, state.debt);
	const created: Bucket = {
		id: input.id,
		kind: input.kind,
		source: input.source,
		initial: input.amount,
		remaining: input.amount - settled,
		expiresAt: input.expiresAt,
		createdAt: input.createdAt
	};
	const lines: Line[] = [{ type: input.type, amount: input.amount, bucketId: input.id }];
	if (settled > 0) {
		lines.push({ type: 'debt_settlement', amount: -settled, bucketId: input.id });
		lines.push({ type: 'debt_settlement', amount: settled, bucketId: null });
	}
	return {
		state: { buckets: [...state.buckets, created], debt: state.debt - settled },
		lines,
		absorbedLossMicro: input.kind === 'free' ? settled : 0
	};
}

// ---------------------------------------------------------------------------------------------------------------------
// Reserva (BE-FR-71, D5, D6)

export function canReserve(input: {
	readonly balance: number;
	readonly reserved: number;
	readonly debt: number;
	readonly maxDebt: number;
	readonly minBalance: number;
	readonly amount: number;
}):
	| { readonly ok: true }
	| { readonly ok: false; readonly reason: 'debt_open' }
	| {
			readonly ok: false;
			readonly reason: 'insufficient_balance';
			readonly requiredMicro: number;
			readonly availableMicro: number;
	  } {
	if (input.debt > 0) return { ok: false, reason: 'debt_open' };
	const available = input.balance - input.reserved;
	const fits = input.amount <= available + (input.maxDebt - input.debt);
	if (available < input.minBalance || !fits) {
		return {
			ok: false,
			reason: 'insufficient_balance',
			requiredMicro: input.amount,
			availableMicro: available
		};
	}
	return { ok: true };
}

// ---------------------------------------------------------------------------------------------------------------------
// Ajuste negativo (BE-FR-18, D-16)

/**
 * Ajuste negativo: solo reduce bolsas del tipo indicado; nunca más que el disponible (D-16) y nunca crea deuda.
 */
export function applyNegativeAdjustment(
	state: LedgerState,
	input: { readonly kind: BucketKind; readonly amount: number; readonly available: number }
):
	| { readonly ok: true; readonly state: LedgerState; readonly lines: readonly Line[] }
	| { readonly ok: false; readonly reason: 'exceeds_available' } {
	const ofKind = consumptionOrder(state.buckets).filter((item) => item.kind === input.kind);
	const kindTotal = ofKind.reduce((sum, item) => sum + item.remaining, 0);
	if (input.amount > input.available || input.amount > kindTotal) {
		return { ok: false, reason: 'exceeds_available' };
	}
	const { takes } = takeFrom(ofKind, input.amount);
	return {
		ok: true,
		state: { buckets: withRemaining(state.buckets, takes), debt: state.debt },
		lines: takes.map((take) => ({
			type: 'adjustment',
			amount: -take.amount,
			bucketId: take.bucketId
		}))
	};
}

// ---------------------------------------------------------------------------------------------------------------------
// Caducidad (BE-FR-16)

/** Pone a cero las bolsas free caducadas con saldo; un movimiento `expiry` por bolsa. */
export function applyExpiry(
	state: LedgerState,
	now: number
): { readonly state: LedgerState; readonly lines: readonly Line[] } {
	const expired = state.buckets.filter(
		(item) =>
			item.kind === 'free' && item.remaining > 0 && item.expiresAt !== null && item.expiresAt <= now
	);
	const lines: Line[] = expired.map((item) => ({
		type: 'expiry',
		amount: -item.remaining,
		bucketId: item.id
	}));
	const ids = new Set(expired.map((item) => item.id));
	return {
		state: {
			buckets: state.buckets.map((item) => (ids.has(item.id) ? { ...item, remaining: 0 } : item)),
			debt: state.debt
		},
		lines
	};
}

// ---------------------------------------------------------------------------------------------------------------------
// Saldo y reconstrucción (BE-FR-15 CA1, D1–D3)

/** Saldo visible: bolsas menos deuda (BE-FR-15). */
export function balanceOf(state: LedgerState): number {
	return state.buckets.reduce((sum, item) => sum + item.remaining, 0) - state.debt;
}

/** Saldo reconstruido desde el ledger: suma de todas las líneas (D3). */
export function reconstruct(lines: readonly Line[]): number {
	return lines.reduce((sum, line) => sum + line.amount, 0);
}

/** Deuda reconstruida desde el ledger: −suma de las líneas sin bolsa (D2). */
export function debtFromLines(lines: readonly Line[]): number {
	const total = lines
		.filter((line) => line.bucketId === null)
		.reduce((sum, line) => sum + line.amount, 0);
	return total === 0 ? 0 : -total;
}
