// Comprobación del ledger contra SQLite real con datos corruptos (BE-FR-15 CA1, SC-003; T331): el saldo materializado de cada
// bolsa y la deuda de cada cuenta deben poder reconstruirse a partir de los movimientos. Sin discrepancias no hay nada que
// avisar; con ellas, un único evento `credits.ledger.mismatch` por ejecución con el recuento de cuentas.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { insertInFlightOperation } from '../../../../../tests/builders/ai-operations';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import { SEEDED_APP_ID } from '../../../../../tests/setup/integration.global-setup';
import { toMicro } from '$lib/shared/money';
import { checkLedger } from './service';
import { creditBuckets, userBalances } from './schema';

const NOW = Date.UTC(2026, 9, 19, 9, 0, 0);
const CREDIT = 1_000_000;

let f: CreditsFixture;

beforeEach(() => {
	f = creditsFixture(NOW);
});

afterEach(() => {
	f.close();
});

function account(id: string): string {
	f.addUser(id);
	f.credits.grantWelcome({ userId: id, emailNormalizedHash: `h-${id}` });
	return id;
}

/** Cobra `amount` créditos a la cuenta para que haya un movimiento `usage` y, si no cabe, deuda. */
function spend(userId: string, amount: number): void {
	const reserved = f.credits.reserve({
		userId,
		appId: SEEDED_APP_ID,
		operationId: insertInFlightOperation(f.db, { userId }),
		amountMicro: Math.min(amount * CREDIT, 5 * CREDIT)
	});
	if (!reserved.ok) throw new Error('la reserva debía caber');
	f.credits.chargeAndRelease({ holdId: reserved.holdId, realCostMicro: amount * CREDIT });
}

describe('checkLedger', () => {
	it('cuentas con bienvenida, consumo y deuda coherentes: sin discrepancias', () => {
		const normal = account('usr_normal');
		spend(normal, 2);
		const indebted = account('usr_con_deuda');
		spend(indebted, 2_000_000);

		expect(checkLedger(f.deps)).toEqual([]);
		expect(eventsNamed(f.logger, 'credits.ledger.mismatch')).toHaveLength(0);
	});

	it('una bolsa cuyo saldo no coincide con sus movimientos se detecta', () => {
		const id = account('usr_bolsa');
		const bucket = f.db.select().from(creditBuckets).where(eq(creditBuckets.userId, id)).get();
		if (bucket === undefined) throw new Error('la bienvenida debía crear una bolsa');
		f.db
			.update(creditBuckets)
			.set({ remainingMicro: toMicro(bucket.remainingMicro - CREDIT) })
			.where(eq(creditBuckets.id, bucket.id))
			.run();

		expect(checkLedger(f.deps)).toEqual([id]);
	});

	it('una deuda que no coincide con la línea nula del ledger se detecta', () => {
		const id = account('usr_deuda');
		spend(id, 2_000_000);
		f.db
			.update(userBalances)
			.set({ debtMicro: toMicro(1) })
			.where(eq(userBalances.userId, id))
			.run();

		expect(checkLedger(f.deps)).toEqual([id]);
	});

	it('un evento por ejecución con el recuento de cuentas, y solo las afectadas', () => {
		const first = account('usr_a');
		const second = account('usr_b');
		account('usr_c');
		for (const id of [first, second]) {
			f.db
				.update(creditBuckets)
				.set({ remainingMicro: toMicro(1) })
				.where(eq(creditBuckets.userId, id))
				.run();
		}

		expect(checkLedger(f.deps).sort()).toEqual([first, second]);
		const events = eventsNamed(f.logger, 'credits.ledger.mismatch');
		expect(events.map((event) => event.fields)).toEqual([{ count: 2 }]);
		expect(JSON.stringify(events)).not.toContain('usr_a');
	});

	it('repetir la comprobación con la misma discrepancia da el mismo resultado', () => {
		const id = account('usr_repetida');
		f.db
			.update(creditBuckets)
			.set({ remainingMicro: toMicro(7) })
			.where(eq(creditBuckets.userId, id))
			.run();

		expect(checkLedger(f.deps)).toEqual([id]);
		expect(checkLedger(f.deps)).toEqual([id]);
	});
});
