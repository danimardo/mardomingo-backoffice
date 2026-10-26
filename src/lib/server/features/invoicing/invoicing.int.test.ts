// Facturación contra SQLite real (T237; BE-FR-74/CA3, BE-FR-75/CA1–CA2): sin factura cuando el proveedor es `none` o la compra
// es simulada, emisión idempotente por `issue_key`, factura completa con el perfil copiado al emitir, rectificativa en
// reembolsos y contracargos, y perfil fiscal validado.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFakeInvoicing } from '$lib/server/adapters/invoicing/fake';
import { createNoneInvoicing } from '$lib/server/adapters/invoicing/none';
import type { InvoicingProvider } from '$lib/server/adapters/invoicing/provider';
import { creditsFixture, type CreditsFixture } from '../../../../../tests/builders/credits';
import { seededRandomBytes } from '../../../../../tests/builders/ids';
import { createIdGenerator } from '$lib/server/shared/ids';
import { eventsNamed } from '../../../../../tests/builders/fake-logger';
import { insertCompletedPurchase } from '../../../../../tests/builders/purchases';
import { createInvoicingService, type InvoicingService } from './service';
import { billingProfiles, invoices } from './schema';

const NOW = Date.UTC(2026, 9, 11, 8, 0, 0);
const PROFILE = {
	kind: 'individual' as const,
	legalName: 'Ana Pérez',
	taxId: '12345678Z',
	address: 'Calle Mayor 1',
	postalCode: '28013',
	city: 'Madrid',
	country: 'ES'
};

let f: CreditsFixture;
let userId: string;

function service(provider: InvoicingProvider): InvoicingService {
	return createInvoicingService({
		db: f.db,
		logger: f.logger,
		clock: f.clock,
		ids: createIdGenerator(seededRandomBytes(7)),
		provider
	});
}

function purchase(paymentId: string, simulated = false): void {
	insertCompletedPurchase(f.db, {
		paymentId,
		userId,
		creditsMicro: 10_500_000_000,
		simulated,
		now: NOW
	});
}

function invoicesOf(paymentId: string) {
	return f.db.select().from(invoices).where(eq(invoices.paymentId, paymentId)).all();
}

beforeEach(() => {
	f = creditsFixture(NOW);
	userId = f.addUser('usr_fact');
});

afterEach(() => {
	f.close();
});

describe('sin factura (BE-FR-75/CA1)', () => {
	it('con el proveedor none no se emite y se registra el motivo', () => {
		purchase('pay_none');

		const outcome = service(createNoneInvoicing()).issueForPayment({
			paymentId: 'pay_none',
			userId,
			simulated: false,
			kind: 'simplified',
			amountEurCents: 1000,
			issueKey: 'payment:pay_none:initial'
		});

		expect(outcome).toEqual({ status: 'skipped', reason: 'provider_none' });
		expect(invoicesOf('pay_none')).toEqual([]);
		expect(eventsNamed(f.logger, 'invoicing.invoice.skipped')).toEqual([
			expect.objectContaining({ fields: { reason: 'provider_none' } })
		]);
	});

	it('[BE-FR-75/CA1] una compra simulada nunca genera factura, aunque el proveedor emita', () => {
		purchase('pay_sim', true);

		const outcome = service(createFakeInvoicing()).issueForPayment({
			paymentId: 'pay_sim',
			userId,
			simulated: true,
			kind: 'simplified',
			amountEurCents: 1000,
			issueKey: 'payment:pay_sim:initial'
		});

		expect(outcome).toEqual({ status: 'skipped', reason: 'simulated' });
		expect(invoicesOf('pay_sim')).toEqual([]);
	});
});

describe('emisión idempotente (BE-FR-75/CA2)', () => {
	it('emite una simplificada sin snapshot y numera la serie', () => {
		purchase('pay_simple');
		const invoicing = service(createFakeInvoicing('A'));

		const outcome = invoicing.issueForPayment({
			paymentId: 'pay_simple',
			userId,
			simulated: false,
			kind: 'simplified',
			amountEurCents: 1000,
			issueKey: 'payment:pay_simple:initial'
		});

		expect(outcome).toMatchObject({ status: 'issued', number: '000001' });
		expect(invoicesOf('pay_simple')).toEqual([
			expect.objectContaining({
				kind: 'simplified',
				series: 'A',
				number: '000001',
				billingSnapshot: null,
				issueKey: 'payment:pay_simple:initial',
				provider: 'fake'
			})
		]);
	});

	it('[BE-FR-75/CA2] la misma clave de emisión no crea una segunda factura y lo registra', () => {
		purchase('pay_dup');
		const invoicing = service(createFakeInvoicing());
		const input = {
			paymentId: 'pay_dup',
			userId,
			simulated: false,
			kind: 'simplified' as const,
			amountEurCents: 1000,
			issueKey: 'payment:pay_dup:initial'
		};

		invoicing.issueForPayment(input);
		const again = invoicing.issueForPayment(input);

		expect(again).toEqual({ status: 'duplicate' });
		expect(invoicesOf('pay_dup')).toHaveLength(1);
		expect(eventsNamed(f.logger, 'invoicing.invoice.duplicate')).toHaveLength(1);
	});
});

describe('factura completa y perfil fiscal (BE-FR-74/CA3)', () => {
	it('[BE-FR-74/CA1] sin perfil fiscal, la completa se rechaza y no se crea nada', () => {
		purchase('pay_sin_perfil');

		const outcome = service(createFakeInvoicing()).issueForPayment({
			paymentId: 'pay_sin_perfil',
			userId,
			simulated: false,
			kind: 'full',
			amountEurCents: 1000,
			issueKey: 'payment:pay_sin_perfil:initial'
		});

		expect(outcome).toEqual({ status: 'rejected', reason: 'billing_profile_required' });
		expect(invoicesOf('pay_sin_perfil')).toEqual([]);
	});

	it('[BE-FR-74/CA3] la completa copia el perfil al emitir y no cambia al editar el perfil después', () => {
		purchase('pay_completa');
		const invoicing = service(createFakeInvoicing());
		invoicing.saveBillingProfile({ userId, profile: PROFILE });
		invoicing.issueForPayment({
			paymentId: 'pay_completa',
			userId,
			simulated: false,
			kind: 'full',
			amountEurCents: 1000,
			issueKey: 'payment:pay_completa:initial'
		});

		invoicing.saveBillingProfile({ userId, profile: { ...PROFILE, legalName: 'Otro nombre' } });

		const [invoice] = invoicesOf('pay_completa');
		expect(invoice?.billingSnapshot).toMatchObject({ legalName: 'Ana Pérez', taxId: '12345678Z' });
	});

	it('guarda el perfil válido y rechaza el inválido, junto al motivo', () => {
		const invoicing = service(createFakeInvoicing());

		expect(invoicing.saveBillingProfile({ userId, profile: PROFILE })).toEqual({ status: 'saved' });
		expect(
			invoicing.saveBillingProfile({ userId, profile: { ...PROFILE, taxId: '00000000A' } })
		).toEqual({ status: 'rejected', reason: 'invoicing_tax_id_invalid' });
		expect(
			f.db.select().from(billingProfiles).where(eq(billingProfiles.userId, userId)).get()
		).toMatchObject({
			taxId: '12345678Z'
		});
		expect(eventsNamed(f.logger, 'invoicing.billing_profile.updated')).toHaveLength(1);
		expect(eventsNamed(f.logger, 'invoicing.billing_profile.rejected')).toHaveLength(1);
	});
});

describe('rectificativa en reembolsos y contracargos (BE-FR-27, BE-FR-28)', () => {
	it('emite una rectificativa con importe negativo que apunta a la factura original', () => {
		purchase('pay_rect');
		const invoicing = service(createFakeInvoicing());
		const original = invoicing.issueForPayment({
			paymentId: 'pay_rect',
			userId,
			simulated: false,
			kind: 'simplified',
			amountEurCents: 1000,
			issueKey: 'payment:pay_rect:initial'
		});
		if (original.status !== 'issued') throw new Error('la factura original debía emitirse');

		const corrective = invoicing.issueCorrective({
			paymentId: 'pay_rect',
			userId,
			simulated: false,
			correctsInvoiceId: original.invoiceId,
			amountEurCents: 400,
			issueKey: 'refund:pay_rect'
		});

		expect(corrective).toMatchObject({ status: 'issued' });
		const rows = invoicesOf('pay_rect').filter((row) => row.kind === 'corrective');
		expect(rows).toEqual([
			expect.objectContaining({
				amountEurCents: -400,
				correctsInvoiceId: original.invoiceId,
				issueKey: 'refund:pay_rect'
			})
		]);
	});
});
