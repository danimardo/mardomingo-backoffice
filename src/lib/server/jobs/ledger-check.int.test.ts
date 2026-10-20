// Tarea `ledger-check` contra SQLite real (BE-FR-15 CA1, SC-003; T331): una discrepancia envía un único email al administrador
// por cuenta aunque la condición se mantenga varias ejecuciones; al cuadrar se rearma y una discrepancia nueva avisa otra vez.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../tests/builders/credits';
import { eventsNamed } from '../../../../tests/builders/fake-logger';
import { pricingDepsOf } from '../../../../tests/builders/pricing';
import { creditBuckets } from '$lib/server/features/credits/schema';
import { toMicro } from '$lib/shared/money';
import { runLedgerCheck } from './ledger-check';

const NOW = Date.UTC(2026, 9, 19, 9, 0, 0);

let f: CreditsFixture;
let sent: { subject: string; text: string }[];
let deps: Parameters<typeof runLedgerCheck>[0];

beforeEach(() => {
	f = creditsFixture(NOW);
	const pricing = pricingDepsOf(f);
	sent = [];
	deps = {
		credits: f.credits,
		db: f.db,
		alerts: {
			...pricing.alerts,
			sender: {
				send: (email) => {
					sent.push({ subject: email.subject, text: email.text });
					return Promise.resolve({ ok: true, providerId: 'fake' });
				}
			}
		}
	};
});

afterEach(() => {
	f.close();
});

function account(id: string): string {
	f.addUser(id);
	f.credits.grantWelcome({ userId: id, emailNormalizedHash: `h-${id}` });
	return id;
}

function corrupt(id: string, remaining: number): void {
	f.db
		.update(creditBuckets)
		.set({ remainingMicro: toMicro(remaining) })
		.where(eq(creditBuckets.userId, id))
		.run();
}

describe('runLedgerCheck', () => {
	it('sin discrepancias no envía nada', async () => {
		account('usr_bien');

		expect(await runLedgerCheck(deps)).toBe(0);
		expect(sent).toEqual([]);
		expect(eventsNamed(f.logger, 'credits.ledger.mismatch')).toHaveLength(0);
	});

	it('una discrepancia sostenida varias ejecuciones envía un único email', async () => {
		const id = account('usr_mal');
		corrupt(id, 5);

		expect(await runLedgerCheck(deps)).toBe(1);
		expect(await runLedgerCheck(deps)).toBe(1);
		expect(await runLedgerCheck(deps)).toBe(1);

		expect(sent).toHaveLength(1);
		expect(sent[0]?.subject).toBe('Discrepancia entre saldo y ledger');
		expect(sent[0]?.text).toContain(id);
		expect(eventsNamed(f.logger, 'credits.ledger.mismatch')).toHaveLength(3);
	});

	it('cada cuenta afectada tiene su propio aviso', async () => {
		corrupt(account('usr_uno'), 5);
		corrupt(account('usr_dos'), 6);

		await runLedgerCheck(deps);

		expect(sent).toHaveLength(2);
	});

	it('al volver a cuadrar se rearma, y una discrepancia nueva avisa de nuevo', async () => {
		const id = account('usr_vuelve');
		const original = f.db.select().from(creditBuckets).where(eq(creditBuckets.userId, id)).get();
		if (original === undefined) throw new Error('la bienvenida debía crear una bolsa');
		corrupt(id, 5);
		await runLedgerCheck(deps);
		expect(sent).toHaveLength(1);

		corrupt(id, original.remainingMicro);
		expect(await runLedgerCheck(deps)).toBe(0);
		expect(eventsNamed(f.logger, 'notifications.alert.rearmed')).toHaveLength(1);

		corrupt(id, 9);
		await runLedgerCheck(deps);
		expect(sent).toHaveLength(2);
	});
});
