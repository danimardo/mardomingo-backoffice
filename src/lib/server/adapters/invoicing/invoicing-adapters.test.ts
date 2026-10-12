// Adaptadores de facturación (BE-FR-75; T231): `none` no emite; el doble numera de forma correlativa.
import { describe, expect, it } from 'vitest';
import { createFakeInvoicing } from './fake';
import { createNoneInvoicing } from './none';

describe('none', () => {
	it('no emite ninguna factura ni PDF', () => {
		const none = createNoneInvoicing();

		expect(
			none.issueInvoice({
				issueKey: 'payment:1:initial',
				amountEurCents: 500,
				billingSnapshot: null
			})
		).toEqual({
			ok: false,
			reason: 'not_issued'
		});
		expect(none.getPdf('x')).toEqual({ ok: false, reason: 'not_available' });
	});
});

describe('fake', () => {
	it('numera de forma correlativa dentro de la serie', () => {
		const fake = createFakeInvoicing('A');

		const first = fake.issueInvoice({ issueKey: 'k1', amountEurCents: 500, billingSnapshot: null });
		const second = fake.issueInvoice({
			issueKey: 'k2',
			amountEurCents: 500,
			billingSnapshot: null
		});

		expect(first.ok && first.invoice.number).toBe('000001');
		expect(second.ok && second.invoice.number).toBe('000002');
		expect(fake.issuedCount()).toBe(2);
	});
});
