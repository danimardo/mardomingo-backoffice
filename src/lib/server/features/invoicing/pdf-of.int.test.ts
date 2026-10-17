// Descarga del PDF de una factura propia (W31; T268; BE-FR-75): con el proveedor de pruebas entrega el PDF, una factura ajena
// no sale, y una factura sin referencia de proveedor (proveedor `none`) no tiene PDF.
import { afterEach, describe, expect, it } from 'vitest';
import {
	panelAccountFixture,
	type PanelAccount
} from '../../../../../tests/builders/panel-account';
import { toEpochMs } from '$lib/shared/time';
import { invoices } from './schema';

let account: PanelAccount;

afterEach(() => {
	account.fixture.close();
});

function insertInvoice(id: string, providerRef: string | null): void {
	account.fixture.base.db
		.insert(invoices)
		.values({
			id,
			paymentId: account.paymentId,
			kind: 'simplified',
			series: 'A',
			number: id,
			billingSnapshot: null,
			amountEurCents: 1000,
			issueKey: `key-${id}`,
			provider: 'fake',
			providerRef,
			pdfRef: null,
			issuedAt: toEpochMs(Date.UTC(2026, 9, 11, 8, 0, 0))
		})
		.run();
}

describe('pdfOf (W31, T268)', () => {
	it('entrega el PDF de una factura propia con el proveedor de pruebas', () => {
		account = panelAccountFixture();
		insertInvoice('inv_propia', 'fake_A000001_key');
		const paymentIds = [account.paymentId];

		const pdf = account.fixture.deps.invoicing.pdfOf(paymentIds, 'inv_propia');
		expect(pdf).toBeInstanceOf(Uint8Array);
		expect(new TextDecoder().decode(pdf)).toContain('%PDF-1.4');
	});

	it('una factura ajena o inexistente no tiene PDF, y una sin referencia tampoco', () => {
		account = panelAccountFixture();
		insertInvoice('inv_sin_ref', null);

		expect(
			account.fixture.deps.invoicing.pdfOf([account.paymentId], 'inv_sin_ref')
		).toBeUndefined();
		expect(account.fixture.deps.invoicing.pdfOf(['pay_ajena'], 'inv_sin_ref')).toBeUndefined();
		expect(account.fixture.deps.invoicing.pdfOf([account.paymentId], 'no_existe')).toBeUndefined();
	});
});
