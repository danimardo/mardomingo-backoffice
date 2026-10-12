// Esquema de facturación contra SQLite real (BE-FR-75, data-model 4.6; T225): cada UNIQUE, CHECK y FOREIGN KEY rechaza la
// fila inválida, y los triggers impiden UPDATE y DELETE sobre `invoices`.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { acceptCurrentLegal } from '../../../../../tests/builders/chat-account';
import { createIdGenerator } from '$lib/server/shared/ids';
import { payments } from '$lib/server/features/payments/schema';
import { invoices } from './schema';
import { toEpochMs } from '$lib/shared/time';

let fixture: CreditsFixture;
let paymentId: string;

function insertPayment(id: string, providerRef: string): void {
	const userId = 'usr_inv';
	const now = toEpochMs(fixture.clock.now());
	const ids = createIdGenerator();
	acceptCurrentLegal({ db: fixture.db, logger: fixture.logger, clock: fixture.clock, ids }, userId);
	fixture.database.sqlite
		.prepare(
			`INSERT INTO payments (id, user_id, pack_id, attempt_id, provider, provider_ref, status, amount_eur_cents, base_eur_cents, vat_eur_cents, vat_rate_ppm, country, credits_micro, wants_full_invoice, simulated, withdrawal_acceptance_id, refunded_eur_cents, created_at, updated_at)
			 SELECT ?, ?, 'pck_seed_5eur', ?, 'simulated', ?, 'pending', 500, 413, 87, 210000, 'ES', 5000000000, 0, 1,
			   (SELECT id FROM terms_acceptances WHERE user_id = ? LIMIT 1), 0, ?, ?`
		)
		.run(id, userId, `att_${id}`, providerRef, userId, now, now);
}

function insertInvoice(
	values: Partial<Record<string, unknown>> & {
		id: string;
		kind: string;
		amount: number;
		series?: string;
		number?: string;
		issueKey?: string;
		corrects?: string | null;
		snapshot?: string | null;
	}
): void {
	fixture.database.sqlite
		.prepare(
			`INSERT INTO invoices (id, payment_id, kind, series, number, billing_snapshot, amount_eur_cents, corrects_invoice_id, issue_key, provider, issued_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'fake', ?)`
		)
		.run(
			values.id,
			paymentId,
			values.kind,
			values.series ?? 'A',
			values.number ?? values.id,
			values.snapshot === undefined ? '{"legalName":"Ana"}' : values.snapshot,
			values.amount,
			values.corrects ?? null,
			values.issueKey ?? `issue:${values.id}`,
			toEpochMs(fixture.clock.now())
		);
}

function attempt(run: () => unknown): boolean {
	try {
		run();
		return true;
	} catch {
		return false;
	}
}

beforeEach(() => {
	fixture = creditsFixture();
	fixture.addUser('usr_inv');
	paymentId = 'pay_base';
	insertPayment(paymentId, 'sim_base');
});

afterEach(() => {
	fixture.close();
});

describe('invoices: unicidad y claves', () => {
	it('una factura emitida no puede repetir serie y número', () => {
		insertInvoice({ id: 'inv_1', kind: 'simplified', amount: 500, series: 'A', number: '1' });

		expect(
			attempt(() =>
				insertInvoice({ id: 'inv_2', kind: 'simplified', amount: 500, series: 'A', number: '1' })
			)
		).toBe(false);
	});

	it('la clave de emisión es única: no se emite dos veces lo mismo', () => {
		insertInvoice({ id: 'inv_1', kind: 'simplified', amount: 500, issueKey: 'payment:x:initial' });

		expect(
			attempt(() =>
				insertInvoice({
					id: 'inv_2',
					kind: 'simplified',
					amount: 500,
					number: '2',
					issueKey: 'payment:x:initial'
				})
			)
		).toBe(false);
	});
});

describe('invoices: CHECK', () => {
	it('una rectificativa debe apuntar a la factura que corrige y tener importe negativo', () => {
		insertInvoice({ id: 'inv_1', kind: 'simplified', amount: 500 });

		expect(
			attempt(() =>
				insertInvoice({ id: 'inv_c1', kind: 'corrective', amount: -500, corrects: null })
			)
		).toBe(false);
		expect(
			attempt(() =>
				insertInvoice({ id: 'inv_c2', kind: 'corrective', amount: 500, corrects: 'inv_1' })
			)
		).toBe(false);
		expect(
			attempt(() =>
				insertInvoice({ id: 'inv_c3', kind: 'corrective', amount: -500, corrects: 'inv_1' })
			)
		).toBe(true);
	});

	it('una factura completa exige datos fiscales en el snapshot', () => {
		expect(
			attempt(() => insertInvoice({ id: 'inv_f1', kind: 'full', amount: 500, snapshot: null }))
		).toBe(false);
		expect(
			attempt(() =>
				insertInvoice({ id: 'inv_f2', kind: 'full', amount: 500, snapshot: '{"legalName":"Ana"}' })
			)
		).toBe(true);
	});

	it('el tipo de factura debe ser simplificada, completa o rectificativa', () => {
		expect(attempt(() => insertInvoice({ id: 'inv_x', kind: 'proforma', amount: 500 }))).toBe(
			false
		);
	});
});

describe('invoices: clave foránea y triggers', () => {
	it('una factura de una compra inexistente se rechaza', () => {
		fixture.database.sqlite.pragma('foreign_keys = ON');
		try {
			expect(
				attempt(() =>
					fixture.database.sqlite
						.prepare(
							`INSERT INTO invoices (id, payment_id, kind, series, number, billing_snapshot, amount_eur_cents, issue_key, provider, issued_at)
							 VALUES ('inv_orf', 'pay_no_existe', 'simplified', 'A', 'orf', NULL, 500, 'orf', 'fake', 0)`
						)
						.run()
				)
			).toBe(false);
		} finally {
			fixture.database.sqlite.pragma('foreign_keys = OFF');
		}
	});

	it('UPDATE y DELETE sobre invoices se rechazan (inmutable)', () => {
		insertInvoice({ id: 'inv_1', kind: 'simplified', amount: 500 });

		expect(
			attempt(() =>
				fixture.database.sqlite
					.prepare("UPDATE invoices SET amount_eur_cents = 1 WHERE id = 'inv_1'")
					.run()
			)
		).toBe(false);
		expect(
			attempt(() =>
				fixture.database.sqlite.prepare("DELETE FROM invoices WHERE id = 'inv_1'").run()
			)
		).toBe(false);
	});
});

describe('payments: referencia de la compra del esquema de facturación', () => {
	it('la compra de prueba existe y es la de la tabla de pagos', () => {
		expect(
			fixture.db
				.select()
				.from(payments)
				.all()
				.map((row) => row.id)
		).toContain(paymentId);
	});
});
