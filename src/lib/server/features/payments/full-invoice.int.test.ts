// Solicitud de factura completa de una compra propia (W30; T268; BE-FR-75): marca la compra, no toca las ajenas y no
// duplica nada al repetirla.
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import {
	panelAccountFixture,
	type PanelAccount
} from '../../../../../tests/builders/panel-account';
import { payments } from './schema';

let account: PanelAccount;

afterEach(() => {
	account.fixture.close();
});

function wantsFullInvoice(paymentId: string): boolean | undefined {
	return account.fixture.base.db
		.select({ wants: payments.wantsFullInvoice })
		.from(payments)
		.where(eq(payments.id, paymentId))
		.get()?.wants;
}

describe('solicitud de factura completa (T268)', () => {
	it('marca una compra propia y repetirla no cambia nada', () => {
		account = panelAccountFixture();
		const { payments: service } = account.fixture;

		expect(
			service.requestFullInvoice({ userId: account.userId, paymentId: account.paymentId })
		).toBe(true);
		expect(
			service.requestFullInvoice({ userId: account.userId, paymentId: account.paymentId })
		).toBe(true);
		expect(wantsFullInvoice(account.paymentId)).toBe(true);
	});

	it('una compra de otra cuenta no se marca y responde false', () => {
		account = panelAccountFixture();
		const { payments: service } = account.fixture;

		expect(service.requestFullInvoice({ userId: 'usr_ajeno', paymentId: account.paymentId })).toBe(
			false
		);
		expect(wantsFullInvoice(account.paymentId)).toBe(false);
	});
});
